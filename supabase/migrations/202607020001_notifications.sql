-- In-app notification center: table, RLS and trigger-driven notifications.
-- Safe to run repeatedly; guards on optional tables that some environments may not have.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT policy for authenticated/anon: rows are only created by the
-- SECURITY DEFINER trigger functions below (which run as the table owner
-- and therefore bypass RLS), so users cannot forge notifications for others.

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only is_read may change on UPDATE; every other field is immutable.
CREATE OR REPLACE FUNCTION public.protect_notification_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.type IS DISTINCT FROM OLD.type OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body OR NEW.link IS DISTINCT FROM OLD.link
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only is_read may be updated on a notification';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_notification_fields ON public.notifications;
CREATE TRIGGER protect_notification_fields
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.protect_notification_fields();

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notifications SET is_read = true WHERE user_id = auth.uid() AND is_read = false;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- Enable realtime delivery for the bell icon.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL; -- no supabase_realtime publication in this environment
END $$;

CREATE OR REPLACE FUNCTION public.notify_user(
  target_user_id UUID, n_type TEXT, n_title TEXT, n_body TEXT, n_link TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (target_user_id, n_type, n_title, n_body, n_link);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- ---- contact_requests: notify receiver on request, sender on decision ----
CREATE OR REPLACE FUNCTION public.notify_contact_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
    PERFORM public.notify_user(NEW.receiver_id, 'contact_request', 'Yeni iletişim talebi',
      COALESCE(sender_name, 'Bir kullanıcı') || ' iletişim bilgilerinizi paylaşmanızı talep etti.', 'profil.html?tab=requests');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'Pending' THEN
    PERFORM public.notify_user(NEW.sender_id, 'contact_request_status',
      CASE WHEN NEW.status = 'Approved' THEN 'İletişim talebiniz onaylandı' ELSE 'İletişim talebiniz reddedildi' END,
      NULL, 'profil.html?tab=requests');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.contact_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notify_contact_request ON public.contact_requests;
    CREATE TRIGGER notify_contact_request AFTER INSERT OR UPDATE ON public.contact_requests
      FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request();
  END IF;
END $$;

-- ---- mentorships: notify mentor on request, student on decision ----
CREATE OR REPLACE FUNCTION public.notify_mentorship()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE student_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO student_name FROM public.profiles WHERE id = NEW.student_id;
    PERFORM public.notify_user(NEW.mentor_id, 'mentorship_request', 'Yeni mentörlük talebi',
      COALESCE(student_name, 'Bir öğrenci') || ' sizden mentörlük talep etti.', 'mentorluk.html');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.student_id, 'mentorship_status',
      CASE NEW.status
        WHEN 'Active' THEN 'Mentörlük talebiniz kabul edildi'
        WHEN 'Cancelled' THEN 'Mentörlük talebiniz reddedildi'
        WHEN 'Completed' THEN 'Mentörlük süreciniz tamamlandı'
        ELSE 'Mentörlük talebinizin durumu güncellendi'
      END, NULL, 'ogrenci.html');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.mentorships') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notify_mentorship ON public.mentorships;
    CREATE TRIGGER notify_mentorship AFTER INSERT OR UPDATE ON public.mentorships
      FOR EACH ROW EXECUTE FUNCTION public.notify_mentorship();
  END IF;
END $$;

-- ---- mentorship_appointments: notify the other party ----
CREATE OR REPLACE FUNCTION public.notify_mentorship_appointment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() = NEW.mentor_id THEN
      PERFORM public.notify_user(NEW.student_id, 'appointment_new', 'Yeni görüşme planlandı',
        'Mentörünüz ' || NEW.appointment_date || ' tarihine bir görüşme planladı.', 'ogrenci.html');
    ELSE
      PERFORM public.notify_user(NEW.mentor_id, 'appointment_new', 'Yeni görüşme talebi',
        'Öğrenciniz ' || NEW.appointment_date || ' tarihine bir görüşme planladı.', 'mentorluk.html');
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = NEW.mentor_id THEN
      PERFORM public.notify_user(NEW.student_id, 'appointment_status', 'Görüşme durumu güncellendi', NULL, 'ogrenci.html');
    ELSE
      PERFORM public.notify_user(NEW.mentor_id, 'appointment_status', 'Görüşme durumu güncellendi', NULL, 'mentorluk.html');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.mentorship_appointments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notify_mentorship_appointment ON public.mentorship_appointments;
    CREATE TRIGGER notify_mentorship_appointment AFTER INSERT OR UPDATE ON public.mentorship_appointments
      FOR EACH ROW EXECUTE FUNCTION public.notify_mentorship_appointment();
  END IF;
END $$;

-- ---- post_comments: notify the post author ----
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE post_author UUID; commenter_name TEXT;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author <> NEW.author_id THEN
    SELECT name INTO commenter_name FROM public.profiles WHERE id = NEW.author_id;
    PERFORM public.notify_user(post_author, 'post_comment', 'Paylaşımınıza yorum yapıldı',
      COALESCE(commenter_name, 'Bir kullanıcı') || ' paylaşımınıza yorum yaptı.', 'topluluk.html');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.post_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notify_post_comment ON public.post_comments;
    CREATE TRIGGER notify_post_comment AFTER INSERT ON public.post_comments
      FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();
  END IF;
END $$;

-- ---- job_applications: notify employer on application, applicant on decision ----
CREATE OR REPLACE FUNCTION public.notify_job_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE posting_employer UUID; posting_title TEXT; applicant_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT employer_id, title INTO posting_employer, posting_title FROM public.job_postings WHERE id = NEW.posting_id;
    SELECT name INTO applicant_name FROM public.profiles WHERE id = NEW.applicant_id;
    PERFORM public.notify_user(posting_employer, 'job_application', 'Yeni başvuru alındı',
      COALESCE(applicant_name, 'Bir kullanıcı') || ' "' || COALESCE(posting_title, 'ilanınıza') || '" ilanınıza başvurdu.', 'kariyer.html');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.applicant_id, 'job_application_status',
      CASE NEW.status WHEN 'Approved' THEN 'Başvurunuz kabul edildi' WHEN 'Rejected' THEN 'Başvurunuz reddedildi' ELSE 'Başvurunuzun durumu güncellendi' END,
      NULL, 'kariyer.html');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.job_applications') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notify_job_application ON public.job_applications;
    CREATE TRIGGER notify_job_application AFTER INSERT OR UPDATE ON public.job_applications
      FOR EACH ROW EXECUTE FUNCTION public.notify_job_application();
  END IF;
END $$;

-- ---- applications (scholarship / mentorship sign-up): notify on decision ----
CREATE OR REPLACE FUNCTION public.notify_application_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.user_id, 'application_status',
      CASE NEW.status WHEN 'Approved' THEN 'Başvurunuz onaylandı' WHEN 'Rejected' THEN 'Başvurunuz reddedildi' ELSE 'Başvurunuzun durumu güncellendi' END,
      NEW.title, 'ogrenci.html');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.applications') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notify_application_status ON public.applications;
    CREATE TRIGGER notify_application_status AFTER UPDATE ON public.applications
      FOR EACH ROW EXECUTE FUNCTION public.notify_application_status();
  END IF;
END $$;

-- ---- data_requests: notify the requester on status change ----
CREATE OR REPLACE FUNCTION public.notify_data_request_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.user_id IS NOT NULL THEN
    PERFORM public.notify_user(NEW.user_id, 'data_request_status', 'Veri talebinizin durumu güncellendi', NEW.status, 'profil.html');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.data_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notify_data_request_status ON public.data_requests;
    CREATE TRIGGER notify_data_request_status AFTER UPDATE ON public.data_requests
      FOR EACH ROW EXECUTE FUNCTION public.notify_data_request_status();
  END IF;
END $$;
