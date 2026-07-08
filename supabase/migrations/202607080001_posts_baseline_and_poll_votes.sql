-- Topluluk baseline'ı ve anket oyları.
-- 1) posts / post_comments tablolarının ve RLS politikalarının migrasyon zincirine
--    alınması (yeni ortamlar bu şemayı üretebilsin; mevcut üretimde IF NOT EXISTS
--    sayesinde tablolar olduğu gibi kalır, politikalar deterministik olarak yenilenir).
-- 2) posts UPDATE yetkisinin yazar/admine kısıtlanması.
-- 3) Anket oylarının içerik JSON'ından ayrı, sunucu tarafında doğrulanan
--    post_poll_votes tablosuna taşınması (istemci artık posts.content'i güncellemez).
-- Tekrar çalıştırılabilir (idempotent).

-- ---- posts / post_comments baseline ----
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  target_year INTEGER,
  target_section TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Üretimdeki eski (adı bilinmeyen, muhtemelen gevşek) politikalar temizlenir;
-- aşağıda bilinen-iyi set deterministik olarak yeniden kurulur.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('posts', 'post_comments')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users read posts"
  ON public.posts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users create own posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and admins update posts"
  ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.is_admin())
  WITH CHECK (auth.uid() = author_id OR public.is_admin());

CREATE POLICY "Authors and admins delete posts"
  ON public.posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_admin());

CREATE POLICY "Authenticated users read comments"
  ON public.post_comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users create own comments"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and admins delete comments"
  ON public.post_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_admin());

-- Gönderi sahipliği alanları güncellemeyle değiştirilemez (diğer *_ownership
-- trigger'larıyla aynı desen).
CREATE OR REPLACE FUNCTION public.protect_post_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Post ownership fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_post_ownership ON public.posts;
CREATE TRIGGER protect_post_ownership BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.protect_post_ownership();

-- ---- Anket oyları: post_poll_votes ----
CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_post_poll_votes_post ON public.post_poll_votes(post_id);

ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read poll votes" ON public.post_poll_votes;
CREATE POLICY "Authenticated users read poll votes"
  ON public.post_poll_votes FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE politikası bilinçli olarak yok: oylar yalnızca
-- cast_poll_vote RPC'si üzerinden, seçenek doğrulanarak yazılır.

CREATE OR REPLACE FUNCTION public.cast_poll_vote(target_post_id UUID, target_option_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_content TEXT;
  parsed JSONB;
  poll_options JSONB;
  option_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT content INTO post_content FROM public.posts WHERE id = target_post_id;
  IF post_content IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  BEGIN
    parsed := post_content::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Post has no poll';
  END;

  IF parsed #>> '{attachment,type}' IS DISTINCT FROM 'poll' THEN
    RAISE EXCEPTION 'Post has no poll';
  END IF;

  poll_options := COALESCE(parsed #> '{attachment,value,options}', '[]'::jsonb);
  IF jsonb_typeof(poll_options) <> 'array' THEN
    RAISE EXCEPTION 'Post has no poll';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(poll_options) AS opt
    WHERE opt ->> 'id' = target_option_id
  ) INTO option_exists;
  IF NOT option_exists THEN
    RAISE EXCEPTION 'Invalid poll option';
  END IF;

  -- Eski sistemde (içerik JSON'undaki votes dizileri) verilmiş oy da tekrar
  -- oy kullanmayı engeller.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(poll_options) AS opt
    WHERE jsonb_typeof(opt -> 'votes') = 'array' AND (opt -> 'votes') ? auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  INSERT INTO public.post_poll_votes (post_id, option_id, voter_id)
  VALUES (target_post_id, target_option_id, auth.uid())
  ON CONFLICT (post_id, voter_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Already voted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_poll_vote(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(UUID, TEXT) TO authenticated;
