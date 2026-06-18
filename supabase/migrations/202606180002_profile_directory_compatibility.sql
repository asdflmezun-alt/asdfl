-- Restores non-sensitive compatibility fields omitted by the hardened directory.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  id, role, name, grad_year, job, city, mentor, grade, branch, bio,
  avatar_url, avatar_position, linkedin_url, github_url, instagram_url,
  class_section, company, university, academic_title, specialization,
  target_university, target_job, created_at,
  CASE WHEN share_email THEN email ELSE NULL END AS email,
  CASE WHEN share_phone THEN phone ELSE NULL END AS phone,
  teaching_year,
  share_email,
  share_phone
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

GRANT SELECT (teaching_year) ON public.profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
