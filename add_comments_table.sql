-- =========================================================================
-- MİGRASYON SORGUSU: TOPLULUK YORUMLARI TABLOSU VE GÜVENLİK KURALLARI (RLS)
-- =========================================================================
-- Bu sorguları Supabase Dashboard üzerindeki "SQL Editor" sekmesinde çalıştırarak
-- canlı bulut veritabanınızda Topluluk yorum yapma özelliğini etkinleştirebilirsiniz.

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security (RLS) Etkinleştirme
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 1. Herkes gönderi yorumlarını görebilir
DROP POLICY IF EXISTS "Herkes yorumları görebilir" ON public.post_comments;
CREATE POLICY "Herkes yorumları görebilir" ON public.post_comments FOR SELECT USING (true);

-- 2. Giriş yapmış tüm kullanıcılar yorum gönderebilir
DROP POLICY IF EXISTS "Kayıtlı kullanıcılar yorum yapabilir" ON public.post_comments;
CREATE POLICY "Kayıtlı kullanıcılar yorum yapabilir" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 3. Yorum sahibi kendi yorumunu silebilir
DROP POLICY IF EXISTS "Yorum sahipleri yorumlarını silebilir" ON public.post_comments;
CREATE POLICY "Yorum sahipleri yorumlarını silebilir" ON public.post_comments FOR DELETE USING (auth.uid() = author_id);
