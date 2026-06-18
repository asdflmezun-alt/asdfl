-- Security hardening baseline. Apply with `supabase db push`.
-- This migration is intentionally idempotent so existing installations can adopt it.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'Admin' AND NOT public.is_admin() THEN
      NEW.role := 'Kullanıcı';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile ownership cannot be changed';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_setting('app.admin_profile_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Role changes must use set_user_role';
  END IF;

  IF NEW.mentor IS DISTINCT FROM OLD.mentor
     AND current_setting('app.admin_profile_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Mentor changes must use set_user_mentor';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;
  IF new_role NOT IN ('Mezun', 'Öğrenci', 'Öğretmen', 'Kullanıcı', 'Admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  PERFORM set_config('app.admin_profile_write', 'on', true);
  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_mentor(target_user_id UUID, enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;
  PERFORM set_config('app.admin_profile_write', 'on', true);
  UPDATE public.profiles SET mentor = enabled WHERE id = target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_mentor(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_mentor(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;
  DELETE FROM auth.users WHERE id = target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user(UUID) TO authenticated;

-- Anonymous clients only receive explicitly shareable directory fields.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  id, role, name, grad_year, job, city, mentor, grade, branch, bio,
  avatar_url, avatar_position, linkedin_url, github_url, instagram_url,
  class_section, company, university, academic_title, specialization,
  target_university, target_job, created_at,
  CASE WHEN share_email THEN email ELSE NULL END AS email,
  CASE WHEN share_phone THEN phone ELSE NULL END AS phone
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.list_profiles_admin(result_limit INTEGER DEFAULT 200)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;
  RETURN QUERY
    SELECT p.* FROM public.profiles p
    ORDER BY p.name
    LIMIT LEAST(GREATEST(result_limit, 1), 500);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_profiles_admin(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_profiles_admin(INTEGER) TO authenticated;

-- Table reads expose only relationship-safe columns. Private contact fields are
-- available through the share-safe view, the owner RPC, or the admin RPC.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, role, name, grad_year, job, city, mentor, grade, branch, bio,
  avatar_url, avatar_position, linkedin_url, github_url, instagram_url,
  class_section, company, university, academic_title, specialization,
  target_university, target_job, teaching_year, created_at
) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Herkes profilleri gorebilir" ON public.profiles;
DROP POLICY IF EXISTS "Herkes profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users read profiles" ON public.profiles;
CREATE POLICY "Authenticated users read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Kullanicilar kendi profilini guncelleyebilir" ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profilini güncelleyebilir" ON public.profiles;
CREATE POLICY "Users update own non-privileged profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Preserve relationship ownership on UPDATE. RLS decides who may update;
-- these triggers decide what an allowed updater may change.
CREATE OR REPLACE FUNCTION public.protect_mentorship_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.mentor_id IS DISTINCT FROM OLD.mentor_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Mentorship ownership fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_appointment_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.mentor_id IS DISTINCT FROM OLD.mentor_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Appointment ownership fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_job_application_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.posting_id IS DISTINCT FROM OLD.posting_id
     OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Job application ownership fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_job_posting_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.employer_id IS DISTINCT FROM OLD.employer_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Job posting ownership fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_internship_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Internship ownership fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.mentorships') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS protect_mentorship_ownership ON public.mentorships;
    CREATE TRIGGER protect_mentorship_ownership BEFORE UPDATE ON public.mentorships
      FOR EACH ROW EXECUTE FUNCTION public.protect_mentorship_ownership();
  END IF;
  IF to_regclass('public.mentorship_appointments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS protect_appointment_ownership ON public.mentorship_appointments;
    CREATE TRIGGER protect_appointment_ownership BEFORE UPDATE ON public.mentorship_appointments
      FOR EACH ROW EXECUTE FUNCTION public.protect_appointment_ownership();
  END IF;
  IF to_regclass('public.job_applications') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS protect_job_application_ownership ON public.job_applications;
    CREATE TRIGGER protect_job_application_ownership BEFORE UPDATE ON public.job_applications
      FOR EACH ROW EXECUTE FUNCTION public.protect_job_application_ownership();
  END IF;
  IF to_regclass('public.job_postings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS protect_job_posting_ownership ON public.job_postings;
    CREATE TRIGGER protect_job_posting_ownership BEFORE UPDATE ON public.job_postings
      FOR EACH ROW EXECUTE FUNCTION public.protect_job_posting_ownership();
  END IF;
  IF to_regclass('public.internship_requests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS protect_internship_ownership ON public.internship_requests;
    CREATE TRIGGER protect_internship_ownership BEFORE UPDATE ON public.internship_requests
      FOR EACH ROW EXECUTE FUNCTION public.protect_internship_ownership();
  END IF;
END $$;

-- Storage enforces a 5 MiB image-only bucket and user-owned paths.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'gallery';

CREATE OR REPLACE FUNCTION public.can_upload_gallery()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    SELECT count(*) FROM storage.objects
    WHERE bucket_id = 'gallery' AND owner_id = auth.uid()::TEXT
  ) < 100;
$$;

REVOKE ALL ON FUNCTION public.can_upload_gallery() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_gallery() TO authenticated;

DROP POLICY IF EXISTS "Kullanicilar galeriye resim yukleyebilir" ON storage.objects;
DROP POLICY IF EXISTS "Kullanıcılar galeriye resim yükleyebilir" ON storage.objects;
CREATE POLICY "Users upload images to own gallery path"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
    AND COALESCE(metadata->>'mimetype', '') IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
    AND public.can_upload_gallery()
  );

CREATE POLICY "Users delete own gallery objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND owner_id = auth.uid()::TEXT);
