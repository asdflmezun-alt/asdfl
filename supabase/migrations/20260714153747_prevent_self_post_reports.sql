-- Kullanıcılar yalnızca başka bir üyeye ait gönderileri bildirebilir.
-- İstemcideki düğme görünürlüğüne güvenilmez; sahiplik RLS ile doğrulanır.

DROP POLICY IF EXISTS "Users create own reports" ON public.post_reports;
CREATE POLICY "Users create own reports"
  ON public.post_reports FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = reporter_id
    AND status = 'Pending'
    AND EXISTS (
      SELECT 1
      FROM public.posts
      WHERE posts.id = post_reports.post_id
        AND posts.author_id <> (SELECT auth.uid())
    )
  );
