-- Security scan fixes:
-- 1) keep post system fields server/admin controlled
-- 2) add explicit RLS policies for legacy workflow tables used by the client

CREATE OR REPLACE FUNCTION public.protect_post_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pinned IS DISTINCT FROM OLD.pinned
     AND current_setting('app.admin_post_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Pinned changes must use set_post_pinned';
  END IF;

  IF NEW.likes_count IS DISTINCT FROM OLD.likes_count
     AND current_setting('app.post_like_counter_write', true) IS DISTINCT FROM 'on'
     AND current_setting('app.admin_post_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Like counters are maintained by post_likes triggers';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_post_system_fields ON public.posts;
CREATE TRIGGER protect_post_system_fields
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.protect_post_system_fields();

CREATE OR REPLACE FUNCTION public.set_post_pinned(target_post_id UUID, is_pinned BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  PERFORM set_config('app.admin_post_write', 'on', true);
  UPDATE public.posts
  SET pinned = is_pinned
  WHERE id = target_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_post_pinned(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_post_pinned(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_post_like_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.post_like_counter_write', 'on', true);

  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET likes_count = COALESCE(likes_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.applications') IS NOT NULL THEN
    ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users and admins read applications" ON public.applications;
    CREATE POLICY "Users and admins read applications"
      ON public.applications FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id OR public.is_admin());

    DROP POLICY IF EXISTS "Users create own pending applications" ON public.applications;
    CREATE POLICY "Users create own pending applications"
      ON public.applications FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'Pending');

    DROP POLICY IF EXISTS "Admins update applications" ON public.applications;
    CREATE POLICY "Admins update applications"
      ON public.applications FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  IF to_regclass('public.scholarships') IS NOT NULL THEN
    ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone reads active scholarships" ON public.scholarships;
    CREATE POLICY "Anyone reads active scholarships"
      ON public.scholarships FOR SELECT TO anon, authenticated
      USING (active = true OR public.is_admin());

    DROP POLICY IF EXISTS "Admins manage scholarships" ON public.scholarships;
    CREATE POLICY "Admins manage scholarships"
      ON public.scholarships FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  IF to_regclass('public.contact_requests') IS NOT NULL THEN
    ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Participants and admins read contact requests" ON public.contact_requests;
    CREATE POLICY "Participants and admins read contact requests"
      ON public.contact_requests FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) IN (sender_id, receiver_id) OR public.is_admin());

    DROP POLICY IF EXISTS "Users create own pending contact requests" ON public.contact_requests;
    CREATE POLICY "Users create own pending contact requests"
      ON public.contact_requests FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = sender_id AND status = 'Pending');

    DROP POLICY IF EXISTS "Receivers and admins update contact requests" ON public.contact_requests;
    CREATE POLICY "Receivers and admins update contact requests"
      ON public.contact_requests FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = receiver_id OR public.is_admin())
      WITH CHECK (((SELECT auth.uid()) = receiver_id OR public.is_admin()) AND status IN ('Pending', 'Approved', 'Rejected'));
  END IF;

  IF to_regclass('public.data_requests') IS NOT NULL THEN
    ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users and admins read data requests" ON public.data_requests;
    CREATE POLICY "Users and admins read data requests"
      ON public.data_requests FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id OR public.is_admin());

    DROP POLICY IF EXISTS "Users create own pending data requests" ON public.data_requests;
    CREATE POLICY "Users create own pending data requests"
      ON public.data_requests FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'Pending');

    DROP POLICY IF EXISTS "Admins update data requests" ON public.data_requests;
    CREATE POLICY "Admins update data requests"
      ON public.data_requests FOR UPDATE TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  IF to_regclass('public.job_postings') IS NOT NULL THEN
    ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users read visible job postings" ON public.job_postings;
    CREATE POLICY "Users read visible job postings"
      ON public.job_postings FOR SELECT TO authenticated
      USING (status = 'Active' OR (SELECT auth.uid()) = employer_id OR public.is_admin());

    DROP POLICY IF EXISTS "Employers create own active job postings" ON public.job_postings;
    CREATE POLICY "Employers create own active job postings"
      ON public.job_postings FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = employer_id AND status = 'Active');

    DROP POLICY IF EXISTS "Employers and admins update job postings" ON public.job_postings;
    CREATE POLICY "Employers and admins update job postings"
      ON public.job_postings FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = employer_id OR public.is_admin())
      WITH CHECK ((SELECT auth.uid()) = employer_id OR public.is_admin());

    DROP POLICY IF EXISTS "Employers and admins delete job postings" ON public.job_postings;
    CREATE POLICY "Employers and admins delete job postings"
      ON public.job_postings FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = employer_id OR public.is_admin());
  END IF;

  IF to_regclass('public.job_applications') IS NOT NULL THEN
    ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Applicants employers and admins read job applications" ON public.job_applications;
    CREATE POLICY "Applicants employers and admins read job applications"
      ON public.job_applications FOR SELECT TO authenticated
      USING (
        (SELECT auth.uid()) = applicant_id
        OR public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.job_postings jp
          WHERE jp.id = job_applications.posting_id
            AND jp.employer_id = (SELECT auth.uid())
        )
      );

    DROP POLICY IF EXISTS "Applicants create own pending job applications" ON public.job_applications;
    CREATE POLICY "Applicants create own pending job applications"
      ON public.job_applications FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = applicant_id AND status = 'Pending');

    DROP POLICY IF EXISTS "Employers and admins update job applications" ON public.job_applications;
    CREATE POLICY "Employers and admins update job applications"
      ON public.job_applications FOR UPDATE TO authenticated
      USING (
        public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.job_postings jp
          WHERE jp.id = job_applications.posting_id
            AND jp.employer_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.job_postings jp
          WHERE jp.id = job_applications.posting_id
            AND jp.employer_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF to_regclass('public.internship_requests') IS NOT NULL THEN
    ALTER TABLE public.internship_requests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users read visible internship requests" ON public.internship_requests;
    CREATE POLICY "Users read visible internship requests"
      ON public.internship_requests FOR SELECT TO authenticated
      USING (status = 'Active' OR (SELECT auth.uid()) = student_id OR public.is_admin());

    DROP POLICY IF EXISTS "Students create own active internship requests" ON public.internship_requests;
    CREATE POLICY "Students create own active internship requests"
      ON public.internship_requests FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = student_id AND status = 'Active');

    DROP POLICY IF EXISTS "Students and admins update internship requests" ON public.internship_requests;
    CREATE POLICY "Students and admins update internship requests"
      ON public.internship_requests FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = student_id OR public.is_admin())
      WITH CHECK ((SELECT auth.uid()) = student_id OR public.is_admin());
  END IF;

  IF to_regclass('public.mentorships') IS NOT NULL THEN
    ALTER TABLE public.mentorships ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Participants and admins read mentorships" ON public.mentorships;
    CREATE POLICY "Participants and admins read mentorships"
      ON public.mentorships FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) IN (mentor_id, student_id) OR public.is_admin());

    DROP POLICY IF EXISTS "Students create own pending mentorships" ON public.mentorships;
    CREATE POLICY "Students create own pending mentorships"
      ON public.mentorships FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = student_id AND status = 'Pending');

    DROP POLICY IF EXISTS "Participants and admins update mentorships" ON public.mentorships;
    CREATE POLICY "Participants and admins update mentorships"
      ON public.mentorships FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) IN (mentor_id, student_id) OR public.is_admin())
      WITH CHECK ((SELECT auth.uid()) IN (mentor_id, student_id) OR public.is_admin());
  END IF;

  IF to_regclass('public.mentorship_appointments') IS NOT NULL THEN
    ALTER TABLE public.mentorship_appointments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Participants and admins read mentorship appointments" ON public.mentorship_appointments;
    CREATE POLICY "Participants and admins read mentorship appointments"
      ON public.mentorship_appointments FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) IN (mentor_id, student_id) OR public.is_admin());

    DROP POLICY IF EXISTS "Participants create mentorship appointments" ON public.mentorship_appointments;
    CREATE POLICY "Participants create mentorship appointments"
      ON public.mentorship_appointments FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) IN (mentor_id, student_id) OR public.is_admin());

    DROP POLICY IF EXISTS "Participants update mentorship appointments" ON public.mentorship_appointments;
    CREATE POLICY "Participants update mentorship appointments"
      ON public.mentorship_appointments FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) IN (mentor_id, student_id) OR public.is_admin())
      WITH CHECK ((SELECT auth.uid()) IN (mentor_id, student_id) OR public.is_admin());
  END IF;
END $$;
