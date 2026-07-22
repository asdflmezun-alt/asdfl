-- Kariyer ilanlarinin sahip/admin tarafindan guvenli silinmesi ve
-- mesaj sikayetlerinin asgari veriyle admin tarafindan incelenmesi.

-- Ilan silindiginde ona ait basvurular anlamsiz ve sahipsiz kalir. Mevcut
-- posting_id foreign key'lerini ON DELETE CASCADE semantigine tasiyarak,
-- RLS'nin izin verdigi tek bir ilan silme islemini atomik hale getiririz.
DO $$
DECLARE
  posting_attnum SMALLINT;
  posting_id_attnum SMALLINT;
  fk_row RECORD;
BEGIN
  IF to_regclass('public.job_postings') IS NULL
     OR to_regclass('public.job_applications') IS NULL THEN
    RETURN;
  END IF;

  SELECT attnum::SMALLINT INTO posting_attnum
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.job_applications'::regclass
    AND attname = 'posting_id'
    AND NOT attisdropped;

  SELECT attnum::SMALLINT INTO posting_id_attnum
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.job_postings'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  IF posting_attnum IS NULL OR posting_id_attnum IS NULL THEN
    RAISE EXCEPTION 'Kariyer tablosu semasi posting_id iliskisiyle uyumlu degil';
  END IF;

  FOR fk_row IN
    SELECT c.conname, c.confdeltype
    FROM pg_catalog.pg_constraint AS c
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.job_applications'::regclass
      AND c.confrelid = 'public.job_postings'::regclass
      AND c.conkey = ARRAY[posting_attnum]::SMALLINT[]
      AND c.confkey = ARRAY[posting_id_attnum]::SMALLINT[]
  LOOP
    IF fk_row.confdeltype <> 'c' THEN
      EXECUTE format(
        'ALTER TABLE public.job_applications DROP CONSTRAINT %I',
        fk_row.conname
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.job_applications'::regclass
      AND c.confrelid = 'public.job_postings'::regclass
      AND c.conkey = ARRAY[posting_attnum]::SMALLINT[]
      AND c.confkey = ARRAY[posting_id_attnum]::SMALLINT[]
      AND c.confdeltype = 'c'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_posting_id_cascade_fkey
      FOREIGN KEY (posting_id)
      REFERENCES public.job_postings(id)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.job_applications
      VALIDATE CONSTRAINT job_applications_posting_id_cascade_fkey;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.job_postings') IS NOT NULL THEN
    ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

    -- Eski kurulumlarda kalan permissive policy'ler kanonik sahiplik
    -- policy'leriyle OR baglanarak yetkiyi genisletebilir. Tamamini temizle.
    DROP POLICY IF EXISTS "Herkes ilanları görebilir"
      ON public.job_postings;
    DROP POLICY IF EXISTS "Yetkili kullanıcılar ilan ekleyebilir"
      ON public.job_postings;
    DROP POLICY IF EXISTS "İlan sahipleri kendi ilanlarını güncelleyebilir"
      ON public.job_postings;
    DROP POLICY IF EXISTS "İlan sahipleri kendi ilanlarını silebilir"
      ON public.job_postings;

    DROP POLICY IF EXISTS "Employers and admins delete job postings"
      ON public.job_postings;
    CREATE POLICY "Employers and admins delete job postings"
      ON public.job_postings FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = employer_id OR public.is_admin());

    -- Data API tablo yetkisi RLS'den ayridir; yeni varsayilanlarda acik bir
    -- DELETE grant'i olmadan guvenli policy'ye hic ulasilamayabilir.
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.job_postings FROM anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_postings TO authenticated;
  END IF;
END;
$$;

-- Normal kullanici yalniz kendi sikayetini, admin tum kuyrugu gorebilir.
-- Mesajlar tablosuna admin icin genis bir SELECT policy eklenmez; gerekli
-- canli mesaj ve profil baglami yalniz asagidaki kontrollu RPC'den doner.
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporters and admins read message reports"
  ON public.message_reports;
CREATE POLICY "Reporters and admins read message reports"
  ON public.message_reports FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reporter_id OR public.is_admin());

REVOKE ALL ON TABLE public.message_reports FROM anon;
GRANT SELECT ON TABLE public.message_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.list_message_reports_admin(
  result_limit INTEGER DEFAULT 100,
  report_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  report_id UUID,
  message_id UUID,
  reporter_id UUID,
  reporter_name TEXT,
  reporter_role TEXT,
  reporter_avatar_url TEXT,
  reason TEXT,
  evidence_body TEXT,
  reported_user_id UUID,
  reported_name TEXT,
  reported_role TEXT,
  reported_avatar_url TEXT,
  status TEXT,
  moderator_id UUID,
  moderator_name TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  live_message_exists BOOLEAN,
  live_conversation_id UUID,
  live_message_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin yetkisi gerekiyor';
  END IF;
  IF report_status IS NOT NULL
     AND report_status NOT IN ('Pending', 'Reviewed', 'Dismissed') THEN
    RAISE EXCEPTION 'Gecersiz sikayet durumu';
  END IF;

  RETURN QUERY
  SELECT
    mr.id,
    mr.message_id,
    mr.reporter_id,
    reporter.name,
    reporter.role,
    reporter.avatar_url,
    mr.reason,
    mr.evidence_body,
    mr.evidence_sender_id,
    reported.name,
    reported.role,
    reported.avatar_url,
    mr.status,
    mr.moderator_id,
    moderator.name,
    mr.reviewed_at,
    mr.created_at,
    (live_message.id IS NOT NULL),
    live_message.conversation_id,
    live_message.created_at
  FROM public.message_reports AS mr
  LEFT JOIN public.profiles AS reporter ON reporter.id = mr.reporter_id
  LEFT JOIN public.profiles AS reported ON reported.id = mr.evidence_sender_id
  LEFT JOIN public.profiles AS moderator ON moderator.id = mr.moderator_id
  LEFT JOIN public.messages AS live_message ON live_message.id = mr.message_id
  WHERE report_status IS NULL OR mr.status = report_status
  ORDER BY mr.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 100), 1), 500);
END;
$$;

REVOKE ALL ON FUNCTION public.list_message_reports_admin(INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_message_reports_admin(INTEGER, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.review_message_report(
  target_report_id UUID,
  new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
BEGIN
  IF caller_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin yetkisi gerekiyor';
  END IF;
  IF new_status NOT IN ('Pending', 'Reviewed', 'Dismissed') THEN
    RAISE EXCEPTION 'Gecersiz sikayet durumu';
  END IF;

  UPDATE public.message_reports
  SET status = new_status,
      moderator_id = CASE WHEN new_status = 'Pending' THEN NULL ELSE caller_id END,
      reviewed_at = CASE WHEN new_status = 'Pending' THEN NULL ELSE NOW() END
  WHERE id = target_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sikayet bulunamadi';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_message_report(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_message_report(UUID, TEXT)
  TO authenticated;
