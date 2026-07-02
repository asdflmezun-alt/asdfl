-- Likes Table and RLS Policies Setup.
-- Run this in your Supabase SQL Editor to configure post likes and automated count triggers.

-- 1. Create post_likes Table if not exists
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for post_likes
DROP POLICY IF EXISTS "Anyone can select post likes" ON public.post_likes;
CREATE POLICY "Anyone can select post likes"
  ON public.post_likes FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own post likes" ON public.post_likes;
CREATE POLICY "Users can insert own post likes"
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own post likes" ON public.post_likes;
CREATE POLICY "Users can delete own post likes"
  ON public.post_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create Trigger to automatically synchronize posts.likes_count
-- This bypasses RLS policies on the posts table since the function runs as SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.handle_post_like_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS update_post_likes_count ON public.post_likes;
CREATE TRIGGER update_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_like_change();
