-- Gönderi moderasyonu: sahibin/adminin silmesi + şikâyet altyapısı.
-- Tekrar çalıştırılabilir (idempotent).

-- ---- Gönderi silme: sahibi veya admin ----
DROP POLICY IF EXISTS "Authors and admins delete posts" ON public.posts;
CREATE POLICY "Authors and admins delete posts"
  ON public.posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_admin());

-- ---- Şikâyet tablosu ----
CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Reviewed', 'Dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reports_status ON public.post_reports(status, created_at DESC);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users create own reports" ON public.post_reports;
CREATE POLICY "Users create own reports"
  ON public.post_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND status = 'Pending');

DROP POLICY IF EXISTS "Users read own reports" ON public.post_reports;
CREATE POLICY "Users read own reports"
  ON public.post_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins update reports" ON public.post_reports;
CREATE POLICY "Admins update reports"
  ON public.post_reports FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Yeni şikâyette tüm adminlere bildirim düşer.
CREATE OR REPLACE FUNCTION public.notify_post_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_row RECORD;
BEGIN
  FOR admin_row IN SELECT id FROM public.profiles WHERE role = 'Admin' LOOP
    PERFORM public.notify_user(admin_row.id, 'post_report', 'Yeni gönderi şikâyeti',
      COALESCE(NULLIF(NEW.reason, ''), 'Neden belirtilmedi'), 'topluluk.html#post-' || NEW.post_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_report ON public.post_reports;
CREATE TRIGGER notify_post_report
  AFTER INSERT ON public.post_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_report();
