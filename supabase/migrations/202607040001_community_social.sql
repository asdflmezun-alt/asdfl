-- Topluluk sosyal özellikleri: sabitlenmiş gönderi, @mention bildirimi, canlı akış.
-- Tekrar çalıştırılabilir (idempotent).

-- ---- Sabitlenmiş gönderi ----
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

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
  UPDATE public.posts SET pinned = is_pinned WHERE id = target_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_post_pinned(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_post_pinned(UUID, BOOLEAN) TO authenticated;

-- ---- Canlı akış: posts realtime yayını ----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL; -- bu ortamda supabase_realtime yayını yok
END $$;

-- ---- @mention bildirimi ----
-- İstemci, zengin gönderi JSON'ına mentions: [{id, name}] dizisi ekler.
-- Gönderi eklendiğinde bahsedilen her (var olan) profile bildirim düşer.
CREATE OR REPLACE FUNCTION public.notify_post_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parsed JSONB;
  mention JSONB;
  mention_id UUID;
  author_name TEXT;
  notified INTEGER := 0;
BEGIN
  BEGIN
    parsed := NEW.content::jsonb;
  EXCEPTION WHEN others THEN
    RETURN NEW; -- düz metin gönderi
  END;

  IF parsed IS NULL OR jsonb_typeof(parsed -> 'mentions') <> 'array' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO author_name FROM public.profiles WHERE id = NEW.author_id;

  FOR mention IN SELECT * FROM jsonb_array_elements(parsed -> 'mentions') LOOP
    EXIT WHEN notified >= 10; -- bildirim spam'ine karşı üst sınır
    BEGIN
      mention_id := (mention ->> 'id')::uuid;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF mention_id IS NULL OR mention_id = NEW.author_id THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = mention_id) THEN CONTINUE; END IF;
    PERFORM public.notify_user(mention_id, 'mention',
      COALESCE(author_name, 'Bir kullanıcı') || ' bir paylaşımda sizden bahsetti',
      NULL, 'topluluk.html#post-' || NEW.id);
    notified := notified + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_mentions ON public.posts;
CREATE TRIGGER notify_post_mentions
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mentions();
