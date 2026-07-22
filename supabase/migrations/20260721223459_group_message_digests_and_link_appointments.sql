-- Mesaj bildirimlerini e-posta ozetinde konusma oturumlari halinde toplar ve
-- mentorluk randevu bildirimlerini ilgili randevuya derin baglar.
--
-- Digest gruplama kurali: ayni kullaniciya, ayni konusma linkiyle gelen ve
-- aralarinda 30 dakikadan uzun bosluk bulunmayan direct_message bildirimleri
-- tek bir ozet ogesidir. Diger bildirimler bire bir korunur.
--
-- Ozet ogeleri en eski guvenli onekten, hedef 20 birim olacak sekilde secilir.
-- Ayni created_at degerindeki sinir birimleri birlikte alinir; secili
-- birimlerin sonraki farkli baslangic zamanindan sonraki devam bildirimleri
-- ise bir sonraki digestte kalir. Boylece ayni transaction zamanini paylasan
-- bildirimler kuyrugu kilitlemez ve
-- Edge Function'in max(created_at) ile yaptigi isaretleme, e-postada yer
-- almayan daha eski bir bildirimi yanlislikla gonderilmis saymaz.

CREATE OR REPLACE FUNCTION public.list_email_digests(batch_size INTEGER DEFAULT 100)
RETURNS TABLE(user_id UUID, email TEXT, name TEXT, unsub_token UUID, notifications JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT
      n.id,
      n.user_id,
      n.type,
      n.title,
      n.body,
      n.link,
      n.created_at,
      n.type = 'direct_message' AND n.link IS NOT NULL AS groupable
    FROM public.notifications AS n
    WHERE n.is_read = false
      AND n.emailed_at IS NULL
  ),
  with_previous AS (
    SELECT
      e.*,
      CASE
        WHEN e.groupable THEN lag(e.created_at) OVER (
          PARTITION BY e.user_id, e.link, e.groupable
          ORDER BY e.created_at, e.id
        )
        ELSE NULL
      END AS previous_created_at
    FROM eligible AS e
  ),
  session_markers AS (
    SELECT
      p.*,
      CASE
        WHEN p.groupable
          AND (
            p.previous_created_at IS NULL
            OR p.created_at > p.previous_created_at + INTERVAL '30 minutes'
          )
        THEN 1
        ELSE 0
      END AS starts_new_session
    FROM with_previous AS p
  ),
  sessioned AS (
    SELECT
      m.*,
      sum(m.starts_new_session) OVER (
        PARTITION BY m.user_id, m.link, m.groupable
        ORDER BY m.created_at, m.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS session_number
    FROM session_markers AS m
  ),
  mapped AS (
    SELECT
      s.*,
      CASE
        WHEN s.groupable
          THEN 'direct_message:' || s.link || ':' || s.session_number::TEXT
        ELSE 'notification:' || s.id::TEXT
      END AS digest_unit
    FROM sessioned AS s
  ),
  unit_starts AS (
    SELECT
      m.user_id,
      m.digest_unit,
      min(m.created_at) AS unit_start
    FROM mapped AS m
    GROUP BY m.user_id, m.digest_unit
  ),
  ranked_units AS (
    SELECT
      u.*,
      row_number() OVER (
        PARTITION BY u.user_id
        ORDER BY u.unit_start, u.digest_unit
      ) AS unit_rank
    FROM unit_starts AS u
  ),
  unit_limits AS (
    SELECT
      r.user_id,
      min(r.unit_start) FILTER (WHERE r.unit_rank = 20) AS included_start_limit
    FROM ranked_units AS r
    GROUP BY r.user_id
  ),
  cutoffs AS (
    SELECT
      l.user_id,
      l.included_start_limit,
      min(r.unit_start) FILTER (
        WHERE l.included_start_limit IS NOT NULL
          AND r.unit_start > l.included_start_limit
      ) AS next_start
    FROM unit_limits AS l
    JOIN ranked_units AS r ON r.user_id = l.user_id
    GROUP BY l.user_id, l.included_start_limit
  ),
  included AS (
    SELECT m.*
    FROM mapped AS m
    JOIN ranked_units AS r
      ON r.user_id = m.user_id
      AND r.digest_unit = m.digest_unit
    JOIN cutoffs AS c ON c.user_id = m.user_id
    WHERE (c.included_start_limit IS NULL OR r.unit_start <= c.included_start_limit)
      AND (c.next_start IS NULL OR m.created_at < c.next_start)
  ),
  summary_units AS (
    SELECT
      i.user_id,
      i.digest_unit,
      bool_or(i.groupable) AS grouped_message,
      count(*)::INTEGER AS notification_count,
      (array_agg(i.type ORDER BY i.created_at DESC, i.id DESC))[1] AS type,
      (array_agg(i.title ORDER BY i.created_at DESC, i.id DESC))[1] AS title,
      (array_agg(i.body ORDER BY i.created_at DESC, i.id DESC))[1] AS body,
      (array_agg(i.link ORDER BY i.created_at DESC, i.id DESC))[1] AS link,
      min(i.created_at) AS first_created_at,
      max(i.created_at) AS last_created_at
    FROM included AS i
    GROUP BY i.user_id, i.digest_unit
  ),
  per_user AS (
    SELECT
      s.user_id,
      min(s.first_created_at) AS first_created_at,
      jsonb_agg(
        jsonb_build_object(
          'type', s.type,
          'title', CASE
            WHEN s.grouped_message AND s.notification_count > 1
              THEN s.notification_count::TEXT || ' yeni mesaj'
            ELSE s.title
          END,
          'body', CASE
            WHEN s.grouped_message AND s.notification_count > 1
              THEN 'Bu konuşmada ' || s.notification_count::TEXT || ' yeni mesajınız var.'
            ELSE s.body
          END,
          'link', s.link,
          'created_at', s.last_created_at
        )
        ORDER BY s.first_created_at, s.digest_unit
      ) AS notifications
    FROM summary_units AS s
    GROUP BY s.user_id
  )
  SELECT
    p.id,
    p.email,
    p.name,
    p.email_unsub_token,
    pu.notifications
  FROM per_user AS pu
  JOIN public.profiles AS p ON p.id = pu.user_id
  WHERE p.email_notifications = true
    AND p.email IS NOT NULL
  ORDER BY pu.first_created_at, p.id
  LIMIT LEAST(GREATEST(COALESCE(batch_size, 100), 1), 500);
END;
$$;

REVOKE ALL ON FUNCTION public.list_email_digests(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_email_digests(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_mentorship_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT auth.uid()) = NEW.mentor_id THEN
      PERFORM public.notify_user(
        NEW.student_id,
        'appointment_new',
        'Yeni görüşme planlandı',
        'Mentörünüz ' || NEW.appointment_date::TEXT || ' tarihine bir görüşme planladı.',
        'ogrenci.html'
      );
    ELSE
      PERFORM public.notify_user(
        NEW.mentor_id,
        'appointment_new',
        'Yeni görüşme talebi',
        'Öğrenciniz ' || NEW.appointment_date::TEXT || ' tarihine bir görüşme planladı.',
        'mentorluk.html?appointment=' || NEW.id::TEXT
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF (SELECT auth.uid()) = NEW.mentor_id THEN
      PERFORM public.notify_user(
        NEW.student_id,
        'appointment_status',
        'Görüşme durumu güncellendi',
        NULL,
        'ogrenci.html'
      );
    ELSE
      PERFORM public.notify_user(
        NEW.mentor_id,
        'appointment_status',
        'Görüşme durumu güncellendi',
        NULL,
        'mentorluk.html?appointment=' || NEW.id::TEXT
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_mentorship_appointment() FROM PUBLIC, anon, authenticated;
