-- ==========================================
-- ASDFL MEZUNLAR DERNEĞİ - SUPABASE SQL ŞEMASI
-- ==========================================

-- 1. PROFİLLER TABLOSU
-- (Kullanıcı kayıt olduğunda auth.users tablosuyla eşleşen profil bilgileri)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('Mezun', 'Öğrenci', 'Öğretmen', 'Kullanıcı')),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  
  -- Mezunlara özel
  grad_year INTEGER,
  job TEXT,
  city TEXT,
  mentor BOOLEAN DEFAULT false,
  
  -- Öğrencilere özel
  grade TEXT,
  
  -- Öğretmenlere özel
  branch TEXT,
  teaching_year INTEGER,
  
  -- Genel profil alanları
  bio TEXT,
  avatar_url TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Profil tablosu güvenlik kuralları (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Herkes profilleri görebilir
CREATE POLICY "Herkes profilleri görebilir" 
  ON public.profiles FOR SELECT 
  USING (true);

-- Kullanıcılar sadece kendi profillerini güncelleyebilir
CREATE POLICY "Kullanıcılar kendi profilini güncelleyebilir" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Kullanıcılar kendi profilini oluşturabilir
CREATE POLICY "Kullanıcılar kendi profilini oluşturabilir" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);


-- 2. ETKİNLİKLER TABLOSU
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TEXT,
  location TEXT,
  type TEXT,
  description TEXT,
  image_url TEXT,
  attendees_count INTEGER DEFAULT 0,
  upcoming BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Etkinlik tablosu RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes etkinlikleri görebilir" ON public.events FOR SELECT USING (true);
CREATE POLICY "Kayıtlı kullanıcılar etkinlik ekleyebilir" ON public.events FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 3. SOSYAL DUVAR (PAYLAŞIMLAR) TABLOSU
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  pinned BOOLEAN DEFAULT false,
  target_year INTEGER,
  target_section TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Paylaşımlar RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes paylaşımları görebilir" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Kayıtlı kullanıcılar paylaşım yapabilir" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);

-- BEĞENİLER TABLOSU
CREATE TABLE public.post_likes (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY(post_id, user_id)
);

-- Beğeniler RLS
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes beğenileri görebilir" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Kullanıcılar kendi beğenilerini yönetebilir" ON public.post_likes FOR ALL USING (auth.uid() = user_id);


-- 4. BURS PROGRAMLARI TABLOSU
CREATE TABLE public.scholarships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  amount TEXT NOT NULL,
  deadline DATE NOT NULL,
  description TEXT,
  sponsor TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Burslar RLS
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes bursları görebilir" ON public.scholarships FOR SELECT USING (true);


-- 5. GALERİ (FOTOĞRAFLAR) TABLOSU
CREATE TABLE public.gallery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  title TEXT,
  category TEXT,
  year INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Galeri RLS
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes galeriyi görebilir" ON public.gallery FOR SELECT USING (true);
CREATE POLICY "Kayıtlı kullanıcılar fotoğraf yükleyebilir" ON public.gallery FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- ==========================================
-- TRIGGER: YENİ KAYIT OLUNCA PROFILE OTOMATİK EKLE
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, role, name, email, grad_year, job, city, grade, branch, teaching_year, class_section,
    phone, share_phone, share_email
  )
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'Kullanıcı'),
    COALESCE((NEW.raw_user_meta_data->>'name')::text, split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'gradYear', '')::INTEGER,
    NEW.raw_user_meta_data->>'job',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'grade',
    NEW.raw_user_meta_data->>'branch',
    NULLIF(NEW.raw_user_meta_data->>'teachingYear', '')::INTEGER,
    NEW.raw_user_meta_data->>'classSection',
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'sharePhone')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'shareEmail')::boolean, false)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı auth.users tablosuna bağlama
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- DEMO VERİLERİ (BAŞLANGIÇ İÇİN)
-- ==========================================
INSERT INTO public.scholarships (title, amount, deadline, description, sponsor, active) VALUES
('STEM Üstün Başarı Bursu', '1000₺/ay', '2025-09-30', 'Fen bilimleri veya mühendislik alanında öğrenim gören, akademik olarak başarılı öğrencilere.', 'Mezun Fonu', true),
('İhtiyaç Odaklı Eğitim Bursu', '750₺/ay', '2025-09-01', 'Maddi imkânları kısıtlı, başarılı öğrencilere yönelik destek bursu.', 'Mezun Bağışları', true);

INSERT INTO public.events (title, event_date, event_time, location, type, description, upcoming) VALUES
('2024 Yılı Mezunlar Buluşması', '2024-06-15', '14:00', 'Afyonkarahisar Kültür Merkezi', 'bulusma', 'Tüm mezun yıllarından katılımcıların bir araya geleceği yıllık buluşma etkinliği.', false),
('Yaz Spor Turnuvası', '2025-07-20', '09:00', 'ASDFL Spor Salonu', 'spor', 'Mezunlar ve öğrenciler arası futsal, satranç ve masa tenisi turnuvası.', true);

-- ==========================================
-- STORAGE (DOSYA DEPOLAMA) GÜVENLİK KURALLARI
-- ==========================================

-- 1. "gallery" adlı bucket için genel okuma erişimi (Herkes fotoğrafları görebilir)
CREATE POLICY "Galeri resimlerini herkes görebilir"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

-- 2. Sadece giriş yapmış kullanıcılar fotoğraf yükleyebilir
CREATE POLICY "Kullanıcılar galeriye resim yükleyebilir"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery' 
    AND auth.role() = 'authenticated'
  );

-- ==========================================
-- GÜNCELLEME SORGULARI (ALTER TABLES)
-- ==========================================
-- (Şube ve sınıf sistemine geçiş için çalıştırılması gereken sorgular)

-- 1. Profiles tablosuna class_section (Şube) sütunu ekleme
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_section TEXT;

-- 2. Posts tablosuna target_year ve target_section ekleme
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS target_year INTEGER;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS target_section TEXT;

-- 3. Beğeniler (post_likes) tablosunu oluşturma
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY(post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes beğenileri görebilir" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Kullanıcılar kendi beğenilerini yönetebilir" ON public.post_likes FOR ALL USING (auth.uid() = user_id);

-- 4. İletişim Bilgileri Paylaşım Sütunları
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_phone BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_email BOOLEAN DEFAULT false;

-- 5. İletişim Bilgisi Talepleri Tablosu
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(sender_id, receiver_id)
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanıcılar ilgili talepleri görebilir" ON public.contact_requests;
CREATE POLICY "Kullanıcılar ilgili talepleri görebilir" 
  ON public.contact_requests FOR SELECT 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Kullanıcılar talep gönderebilir" ON public.contact_requests;
CREATE POLICY "Kullanıcılar talep gönderebilir" 
  ON public.contact_requests FOR INSERT 
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Alıcı talebi güncelleyebilir" ON public.contact_requests;
CREATE POLICY "Alıcı talebi güncelleyebilir" 
  ON public.contact_requests FOR UPDATE 
  USING (auth.uid() = receiver_id);


-- ==========================================
-- ADMIN PANEL & BAŞVURU SİSTEMİ GÜNCELLEMELERİ
-- ==========================================

-- 1. Profiles tablosundaki 'role' kısıtlamasını güncelleyip 'Admin' rolünü ekleme
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('Mezun', 'Öğrenci', 'Öğretmen', 'Kullanıcı', 'Admin'));

-- 2. Yeni 'applications' (Burs ve Mentörlük Başvuruları) tablosu
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Burs', 'MentorlukTalebi', 'MentorlukKaydi')),
  title TEXT, -- e.g. burs adı ya da ilgi alanı
  details JSONB NOT NULL DEFAULT '{}'::jsonb, -- dinamik form alanları
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Applications RLS yetkilendirmesi
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanıcılar kendi başvurularını görebilir" ON public.applications;
CREATE POLICY "Kullanıcılar kendi başvurularını görebilir" 
  ON public.applications FOR SELECT 
  USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Kullanıcılar başvuru yapabilir" ON public.applications;
CREATE POLICY "Kullanıcılar başvuru yapabilir" 
  ON public.applications FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sadece adminler başvuruları güncelleyebilir" ON public.applications;
CREATE POLICY "Sadece adminler başvuruları güncelleyebilir" 
  ON public.applications FOR UPDATE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Sadece adminler başvuruları silebilir" ON public.applications;
CREATE POLICY "Sadece adminler başvuruları silebilir" 
  ON public.applications FOR DELETE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

-- 4. Adminler için diğer tablolara ek yetki tanımları
DROP POLICY IF EXISTS "Adminler tüm profilleri güncelleyebilir" ON public.profiles;
CREATE POLICY "Adminler tüm profilleri güncelleyebilir" 
  ON public.profiles FOR UPDATE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Adminler etkinlik güncelleyebilir" ON public.events;
CREATE POLICY "Adminler etkinlik güncelleyebilir" 
  ON public.events FOR UPDATE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Adminler etkinlik silebilir" ON public.events;
CREATE POLICY "Adminler etkinlik silebilir" 
  ON public.events FOR DELETE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Adminler burs ekleyebilir" ON public.scholarships;
CREATE POLICY "Adminler burs ekleyebilir" 
  ON public.scholarships FOR INSERT 
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Adminler burs güncelleyebilir" ON public.scholarships;
CREATE POLICY "Adminler burs güncelleyebilir" 
  ON public.scholarships FOR UPDATE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Adminler burs silebilir" ON public.scholarships;
CREATE POLICY "Adminler burs silebilir" 
  ON public.scholarships FOR DELETE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Adminler galeri öğelerini silebilir" ON public.gallery;
CREATE POLICY "Adminler galeri öğelerini silebilir" 
  ON public.gallery FOR DELETE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');
