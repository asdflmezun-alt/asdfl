-- ==========================================
-- ASDFL MEZUNLAR DERNEĞİ - LOGO DUYURULARI ŞEMASI
-- ==========================================

-- 1. TABLO OLUŞTURMA
CREATE TABLE IF NOT EXISTS public.logo_announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  icon TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. GÜVENLİK KURALLARI (RLS) AKTİFLEŞTİRME
ALTER TABLE public.logo_announcements ENABLE ROW LEVEL SECURITY;

-- 3. POLİTİKALARI TANIMLAMA

-- Herkes duyuru kartlarını okuyabilir
DROP POLICY IF EXISTS "Herkes duyuru kartlarını görebilir" ON public.logo_announcements;
CREATE POLICY "Herkes duyuru kartlarını görebilir" 
  ON public.logo_announcements FOR SELECT 
  USING (true);

-- Sadece sistem yöneticileri (Admin) duyuru kartlarını güncelleyebilir
DROP POLICY IF EXISTS "Adminler duyuru kartlarını güncelleyebilir" ON public.logo_announcements;
CREATE POLICY "Adminler duyuru kartlarını güncelleyebilir" 
  ON public.logo_announcements FOR UPDATE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

-- Sadece sistem yöneticileri (Admin) duyuru kartlarını silebilir/ekleyebilir
DROP POLICY IF EXISTS "Adminler duyuru kartlarını yönetebilir" ON public.logo_announcements;
CREATE POLICY "Adminler duyuru kartlarını yönetebilir" 
  ON public.logo_announcements FOR ALL 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

-- 4. VARSAYILAN DEĞERLERİ YÜKLEME (SEEDING)
-- Not: Eğer veriler zaten varsa üzerine yazmamak için ON CONFLICT kontrolü yapılır.
INSERT INTO public.logo_announcements (id, title, subtitle, icon) VALUES
(1, '2025 Mezunları', '128 yeni mezun', 'graduation-cap'),
(2, 'Burs Başvurusu', 'Son 5 gün!', 'award'),
(3, 'Yaz Turnuvası', '20 Temmuz 2025', 'calendar')
ON CONFLICT (id) DO NOTHING;

-- SERIAL id sayacını güncelleme (eğer manuel veri girişi olduysa çakışma olmaması için)
SELECT setval(pg_get_serial_sequence('public.logo_announcements', 'id'), COALESCE((SELECT MAX(id)+1 FROM public.logo_announcements), 1), false);
