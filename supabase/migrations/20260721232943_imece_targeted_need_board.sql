-- İmece targeted need board: private routing metadata and guarded write RPCs.

CREATE TABLE IF NOT EXISTS public.imece_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('contact', 'health', 'career', 'education', 'legal', 'technical', 'logistics', 'other')
  ),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 8 AND 140),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 20 AND 2500),
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  audience_all BOOLEAN NOT NULL DEFAULT false,
  target_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (cardinality(target_roles) <= 20),
  target_cities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (cardinality(target_cities) <= 20),
  target_jobs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (cardinality(target_jobs) <= 20),
  target_companies TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (cardinality(target_companies) <= 20),
  target_universities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (cardinality(target_universities) <= 20),
  target_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[] CHECK (cardinality(target_user_ids) <= 50),
  is_broadcast BOOLEAN NOT NULL DEFAULT false,
  notification_recipient_count INTEGER NOT NULL DEFAULT 0
    CHECK (notification_recipient_count BETWEEN 0 AND 1000),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT imece_requests_has_audience CHECK (
    audience_all
    OR cardinality(target_roles) > 0
    OR cardinality(target_cities) > 0
    OR cardinality(target_jobs) > 0
    OR cardinality(target_companies) > 0
    OR cardinality(target_universities) > 0
    OR cardinality(target_user_ids) > 0
  ),
  CONSTRAINT imece_requests_expiry_window CHECK (
    expires_at > created_at AND expires_at <= created_at + INTERVAL '30 days'
  ),
  CONSTRAINT imece_requests_resolution_consistent CHECK (
    (status = 'resolved' AND resolved_at IS NOT NULL)
    OR (status <> 'resolved' AND resolved_at IS NULL)
  ),
  CONSTRAINT imece_requests_timestamps_ordered CHECK (updated_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_imece_requests_author_created
  ON public.imece_requests(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imece_requests_open_feed
  ON public.imece_requests(expires_at, created_at DESC)
  WHERE status = 'open';

ALTER TABLE public.imece_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated members read imece requests" ON public.imece_requests;
CREATE POLICY "Authenticated members read imece requests"
  ON public.imece_requests FOR SELECT TO authenticated
  USING (status <> 'open' OR expires_at > NOW());

-- Target arrays, explicit UUIDs and fanout metrics are private routing metadata.
REVOKE ALL ON TABLE public.imece_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, author_id, category, title, description, urgency, status, audience_all,
  expires_at, created_at, updated_at, resolved_at
) ON TABLE public.imece_requests TO authenticated;

CREATE OR REPLACE VIEW public.imece_request_feed
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id, author_id, category, title, description, urgency, status, audience_all,
  expires_at, created_at, updated_at, resolved_at
FROM public.imece_requests
WHERE status <> 'open' OR expires_at > NOW();

REVOKE ALL ON TABLE public.imece_request_feed FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.imece_request_feed TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_imece_request_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.urgency IS DISTINCT FROM OLD.urgency
     OR NEW.audience_all IS DISTINCT FROM OLD.audience_all
     OR NEW.target_roles IS DISTINCT FROM OLD.target_roles
     OR NEW.target_cities IS DISTINCT FROM OLD.target_cities
     OR NEW.target_jobs IS DISTINCT FROM OLD.target_jobs
     OR NEW.target_companies IS DISTINCT FROM OLD.target_companies
     OR NEW.target_universities IS DISTINCT FROM OLD.target_universities
     OR NEW.target_user_ids IS DISTINCT FROM OLD.target_user_ids
     OR NEW.is_broadcast IS DISTINCT FROM OLD.is_broadcast
     OR NEW.notification_recipient_count IS DISTINCT FROM OLD.notification_recipient_count
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'İmece çağrısının sahiplik ve içerik alanları değiştirilemez';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_imece_request_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_imece_request_fields ON public.imece_requests;
CREATE TRIGGER protect_imece_request_fields
  BEFORE UPDATE ON public.imece_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_imece_request_fields();

CREATE OR REPLACE FUNCTION public.create_imece_request(
  p_category TEXT,
  p_title TEXT,
  p_description TEXT,
  p_urgency TEXT DEFAULT 'normal',
  p_audience_all BOOLEAN DEFAULT false,
  p_target_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_target_cities TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_target_jobs TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_target_companies TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_target_universities TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_target_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  clean_category TEXT := pg_catalog.lower(pg_catalog.btrim(p_category));
  clean_title TEXT := pg_catalog.btrim(p_title);
  clean_description TEXT := pg_catalog.btrim(p_description);
  clean_urgency TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_urgency, 'normal')));
  clean_audience_all BOOLEAN := COALESCE(p_audience_all, false);
  clean_roles TEXT[];
  clean_cities TEXT[];
  clean_jobs TEXT[];
  clean_companies TEXT[];
  clean_universities TEXT[];
  clean_user_ids UUID[];
  matched_recipient_ids UUID[] := ARRAY[]::UUID[];
  matched_recipient_count INTEGER := 0;
  available_recipient_count INTEGER := 0;
  broad_notification BOOLEAN := false;
  clean_expires_at TIMESTAMPTZ;
  request_time TIMESTAMPTZ := pg_catalog.now();
  new_request_id UUID := pg_catalog.gen_random_uuid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'İmece çağrısı oluşturmak için giriş yapmalısınız';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = caller_id) THEN
    RAISE EXCEPTION 'Üye profili bulunamadı';
  END IF;

  IF clean_category IS NULL OR clean_category NOT IN (
    'contact', 'health', 'career', 'education', 'legal', 'technical', 'logistics', 'other'
  ) THEN
    RAISE EXCEPTION 'Geçersiz İmece kategorisi';
  END IF;
  IF clean_title IS NULL OR pg_catalog.char_length(clean_title) NOT BETWEEN 8 AND 140 THEN
    RAISE EXCEPTION 'Başlık 8 ile 140 karakter arasında olmalıdır';
  END IF;
  IF clean_description IS NULL OR pg_catalog.char_length(clean_description) NOT BETWEEN 20 AND 2500 THEN
    RAISE EXCEPTION 'Açıklama 20 ile 2500 karakter arasında olmalıdır';
  END IF;
  IF clean_urgency NOT IN ('normal', 'urgent') THEN
    RAISE EXCEPTION 'Geçersiz aciliyet değeri';
  END IF;

  IF pg_catalog.cardinality(COALESCE(p_target_roles, ARRAY[]::TEXT[])) > 20
     OR pg_catalog.cardinality(COALESCE(p_target_cities, ARRAY[]::TEXT[])) > 20
     OR pg_catalog.cardinality(COALESCE(p_target_jobs, ARRAY[]::TEXT[])) > 20
     OR pg_catalog.cardinality(COALESCE(p_target_companies, ARRAY[]::TEXT[])) > 20
     OR pg_catalog.cardinality(COALESCE(p_target_universities, ARRAY[]::TEXT[])) > 20
     OR pg_catalog.cardinality(COALESCE(p_target_user_ids, ARRAY[]::UUID[])) > 50 THEN
    RAISE EXCEPTION 'Çok fazla hedef seçildi';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(x.term ORDER BY x.term), ARRAY[]::TEXT[])
  INTO clean_roles
  FROM (
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(u.value)) AS term
    FROM pg_catalog.unnest(COALESCE(p_target_roles, ARRAY[]::TEXT[])) AS u(value)
    WHERE NULLIF(pg_catalog.btrim(u.value), '') IS NOT NULL
  ) AS x;
  SELECT COALESCE(pg_catalog.array_agg(x.term ORDER BY x.term), ARRAY[]::TEXT[])
  INTO clean_cities
  FROM (
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(u.value)) AS term
    FROM pg_catalog.unnest(COALESCE(p_target_cities, ARRAY[]::TEXT[])) AS u(value)
    WHERE NULLIF(pg_catalog.btrim(u.value), '') IS NOT NULL
  ) AS x;
  SELECT COALESCE(pg_catalog.array_agg(x.term ORDER BY x.term), ARRAY[]::TEXT[])
  INTO clean_jobs
  FROM (
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(u.value)) AS term
    FROM pg_catalog.unnest(COALESCE(p_target_jobs, ARRAY[]::TEXT[])) AS u(value)
    WHERE NULLIF(pg_catalog.btrim(u.value), '') IS NOT NULL
  ) AS x;
  SELECT COALESCE(pg_catalog.array_agg(x.term ORDER BY x.term), ARRAY[]::TEXT[])
  INTO clean_companies
  FROM (
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(u.value)) AS term
    FROM pg_catalog.unnest(COALESCE(p_target_companies, ARRAY[]::TEXT[])) AS u(value)
    WHERE NULLIF(pg_catalog.btrim(u.value), '') IS NOT NULL
  ) AS x;
  SELECT COALESCE(pg_catalog.array_agg(x.term ORDER BY x.term), ARRAY[]::TEXT[])
  INTO clean_universities
  FROM (
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(u.value)) AS term
    FROM pg_catalog.unnest(COALESCE(p_target_universities, ARRAY[]::TEXT[])) AS u(value)
    WHERE NULLIF(pg_catalog.btrim(u.value), '') IS NOT NULL
  ) AS x;
  SELECT COALESCE(pg_catalog.array_agg(x.target_id ORDER BY x.target_id), ARRAY[]::UUID[])
  INTO clean_user_ids
  FROM (
    SELECT DISTINCT u.value AS target_id
    FROM pg_catalog.unnest(COALESCE(p_target_user_ids, ARRAY[]::UUID[])) AS u(value)
    WHERE u.value IS NOT NULL AND u.value <> caller_id
  ) AS x;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(
      clean_roles || clean_cities || clean_jobs || clean_companies || clean_universities
    ) AS target(term)
    WHERE pg_catalog.char_length(target.term) NOT BETWEEN 2 AND 80
  ) THEN
    RAISE EXCEPTION 'Hedef terimleri 2 ile 80 karakter arasında olmalıdır';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(clean_user_ids) AS target(user_id)
    LEFT JOIN public.profiles AS p ON p.id = target.user_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Hedef üyelerden biri bulunamadı';
  END IF;
  IF NOT clean_audience_all
     AND pg_catalog.cardinality(clean_roles) = 0
     AND pg_catalog.cardinality(clean_cities) = 0
     AND pg_catalog.cardinality(clean_jobs) = 0
     AND pg_catalog.cardinality(clean_companies) = 0
     AND pg_catalog.cardinality(clean_universities) = 0
     AND pg_catalog.cardinality(clean_user_ids) = 0 THEN
    RAISE EXCEPTION 'En az bir hedef kitle seçmelisiniz';
  END IF;

  clean_expires_at := COALESCE(p_expires_at, request_time + INTERVAL '7 days');
  IF clean_expires_at <= request_time OR clean_expires_at > request_time + INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Son geçerlilik tarihi gelecek 30 gün içinde olmalıdır';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('create-imece-request'),
    pg_catalog.hashtext(caller_id::TEXT)
  );
  IF (
    SELECT pg_catalog.count(*)
    FROM public.imece_requests AS r
    WHERE r.author_id = caller_id
      AND r.created_at > request_time - INTERVAL '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION '24 saatlik İmece çağrısı limitine ulaştınız';
  END IF;

  SELECT pg_catalog.count(*)
  INTO available_recipient_count
  FROM public.profiles AS p
  WHERE p.id <> caller_id;

  SELECT COALESCE(pg_catalog.array_agg(matches.id ORDER BY matches.id), ARRAY[]::UUID[])
  INTO matched_recipient_ids
  FROM (
    SELECT p.id
    FROM public.profiles AS p
    WHERE p.id <> caller_id
      AND (
        clean_audience_all
        OR p.id = ANY(clean_user_ids)
        OR EXISTS (
          SELECT 1 FROM pg_catalog.unnest(clean_roles) AS target(term)
          WHERE pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.role, ''))), target.term) > 0
        )
        OR EXISTS (
          SELECT 1 FROM pg_catalog.unnest(clean_cities) AS target(term)
          WHERE pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.city, ''))), target.term) > 0
        )
        OR EXISTS (
          SELECT 1 FROM pg_catalog.unnest(clean_jobs) AS target(term)
          WHERE pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.job, ''))), target.term) > 0
             OR pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.specialization, ''))), target.term) > 0
             OR pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.academic_title, ''))), target.term) > 0
             OR pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.target_job, ''))), target.term) > 0
        )
        OR EXISTS (
          SELECT 1 FROM pg_catalog.unnest(clean_companies) AS target(term)
          WHERE pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.company, ''))), target.term) > 0
        )
        OR EXISTS (
          SELECT 1 FROM pg_catalog.unnest(clean_universities) AS target(term)
          WHERE pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(COALESCE(p.university, ''))), target.term) > 0
        )
      )
    ORDER BY p.id
    LIMIT 1001
  ) AS matches;

  matched_recipient_count := pg_catalog.cardinality(matched_recipient_ids);
  IF matched_recipient_count > 1000 THEN
    RAISE EXCEPTION 'Bir İmece çağrısı en fazla 1000 üyeye bildirim gönderebilir';
  END IF;
  broad_notification := clean_audience_all
    OR matched_recipient_count >= 250
    OR (available_recipient_count > 0
        AND matched_recipient_count * 2 >= available_recipient_count);

  IF broad_notification AND (
    SELECT pg_catalog.count(*)
    FROM public.imece_requests AS r
    WHERE r.author_id = caller_id
      AND r.is_broadcast = true
      AND r.created_at > request_time - INTERVAL '24 hours'
  ) >= 1 THEN
    RAISE EXCEPTION '24 saatte yalnızca bir geniş kitleli İmece çağrısı oluşturabilirsiniz';
  END IF;

  INSERT INTO public.imece_requests (
    id, author_id, category, title, description, urgency, status, audience_all,
    target_roles, target_cities, target_jobs, target_companies, target_universities,
    target_user_ids, is_broadcast, notification_recipient_count,
    expires_at, created_at, updated_at
  ) VALUES (
    new_request_id, caller_id, clean_category, clean_title, clean_description,
    clean_urgency, 'open', clean_audience_all, clean_roles, clean_cities, clean_jobs,
    clean_companies, clean_universities, clean_user_ids, broad_notification,
    matched_recipient_count, clean_expires_at, request_time, request_time
  );

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    recipient.id,
    'imece_request',
    'Yeni İmece çağrısı',
    'İmece panosunda size uygun yeni bir ihtiyaç paylaşıldı.',
    'imece.html?request=' || new_request_id::TEXT
  FROM pg_catalog.unnest(matched_recipient_ids) AS recipient(id);

  RETURN new_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_imece_request_status(
  p_request_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  request_author_id UUID;
  request_expires_at TIMESTAMPTZ;
  clean_status TEXT := pg_catalog.lower(pg_catalog.btrim(p_status));
  change_time TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'İmece çağrısını güncellemek için giriş yapmalısınız';
  END IF;
  IF clean_status IS NULL OR clean_status NOT IN ('open', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Geçersiz İmece durumu';
  END IF;
  SELECT r.author_id, r.expires_at
  INTO request_author_id, request_expires_at
  FROM public.imece_requests AS r
  WHERE r.id = p_request_id
  FOR UPDATE;
  IF request_author_id IS NULL THEN
    RAISE EXCEPTION 'İmece çağrısı bulunamadı';
  END IF;
  IF caller_id <> request_author_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Bu İmece çağrısını güncelleme yetkiniz yok';
  END IF;
  IF clean_status = 'open' AND request_expires_at <= change_time THEN
    RAISE EXCEPTION 'Süresi geçmiş bir İmece çağrısı yeniden açılamaz';
  END IF;
  UPDATE public.imece_requests AS r
  SET status = clean_status,
      resolved_at = CASE
        WHEN clean_status = 'resolved' THEN COALESCE(r.resolved_at, change_time)
        ELSE NULL
      END,
      updated_at = change_time
  WHERE r.id = p_request_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.imece_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.imece_requests(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 500),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Reviewed', 'Dismissed')),
  moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT imece_reports_one_per_member UNIQUE (request_id, reporter_id),
  CONSTRAINT imece_reports_review_consistent CHECK (
    (status = 'Pending' AND moderator_id IS NULL AND reviewed_at IS NULL)
    OR (status IN ('Reviewed', 'Dismissed') AND moderator_id IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_imece_reports_reporter_created
  ON public.imece_reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imece_reports_request
  ON public.imece_reports(request_id);

ALTER TABLE public.imece_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reporters and admins read imece reports" ON public.imece_reports;
CREATE POLICY "Reporters and admins read imece reports"
  ON public.imece_reports FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reporter_id OR public.is_admin());

REVOKE ALL ON TABLE public.imece_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.imece_reports TO authenticated;
GRANT SELECT ON TABLE public.imece_reports TO service_role;

CREATE OR REPLACE FUNCTION public.report_imece_request(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  clean_reason TEXT := pg_catalog.btrim(p_reason);
  request_author_id UUID;
  new_report_id UUID := pg_catalog.gen_random_uuid();
  report_time TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Şikâyet göndermek için giriş yapmalısınız';
  END IF;
  IF clean_reason IS NULL OR pg_catalog.char_length(clean_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Şikâyet nedeni 10 ile 500 karakter arasında olmalıdır';
  END IF;
  SELECT r.author_id
  INTO request_author_id
  FROM public.imece_requests AS r
  WHERE r.id = p_request_id;
  IF request_author_id IS NULL THEN
    RAISE EXCEPTION 'İmece çağrısı bulunamadı';
  END IF;
  IF request_author_id = caller_id THEN
    RAISE EXCEPTION 'Kendi İmece çağrınızı şikâyet edemezsiniz';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('report-imece-request'),
    pg_catalog.hashtext(caller_id::TEXT)
  );
  IF EXISTS (
    SELECT 1 FROM public.imece_reports AS r
    WHERE r.request_id = p_request_id AND r.reporter_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Bu İmece çağrısını daha önce şikâyet ettiniz';
  END IF;
  IF (
    SELECT pg_catalog.count(*)
    FROM public.imece_reports AS r
    WHERE r.reporter_id = caller_id
      AND r.created_at > report_time - INTERVAL '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION '24 saatlik şikâyet limitine ulaştınız';
  END IF;
  INSERT INTO public.imece_reports (id, request_id, reporter_id, reason, created_at)
  VALUES (new_report_id, p_request_id, caller_id, clean_reason, report_time);

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    p.id,
    'imece_report',
    'Yeni İmece şikâyeti',
    'İmece panosunda incelenmesi gereken yeni bir şikâyet var.',
    'yonetim.html#moderation'
  FROM public.profiles AS p
  WHERE p.role = 'Admin';
  RETURN new_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_imece_report(
  p_report_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  clean_status TEXT := pg_catalog.lower(pg_catalog.btrim(p_status));
  normalized_status TEXT;
  locked_report_id UUID;
BEGIN
  IF caller_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'İmece şikâyetini incelemek için admin yetkisi gerekiyor';
  END IF;
  normalized_status := CASE clean_status
    WHEN 'reviewed' THEN 'Reviewed'
    WHEN 'dismissed' THEN 'Dismissed'
    ELSE NULL
  END;
  IF normalized_status IS NULL THEN
    RAISE EXCEPTION 'Geçersiz İmece şikâyeti durumu';
  END IF;
  SELECT r.id
  INTO locked_report_id
  FROM public.imece_reports AS r
  WHERE r.id = p_report_id
  FOR UPDATE;
  IF locked_report_id IS NULL THEN
    RAISE EXCEPTION 'İmece şikâyeti bulunamadı';
  END IF;
  UPDATE public.imece_reports AS r
  SET status = normalized_status,
      moderator_id = caller_id,
      reviewed_at = pg_catalog.now()
  WHERE r.id = locked_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_imece_request(
  TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], UUID[], TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_imece_request_status(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_imece_request(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_imece_report(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_imece_request(
  TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT[], TEXT[], TEXT[], UUID[], TIMESTAMPTZ
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_imece_request_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_imece_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_imece_report(UUID, TEXT) TO authenticated;
