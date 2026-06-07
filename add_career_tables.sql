-- =========================================================================
-- MİGRASYON SORGUSU: KARİYER AĞI TABLOLARI VE RLS KURALLARI
-- =========================================================================
-- Bu sorguları Supabase Dashboard üzerindeki "SQL Editor" sekmesinde çalıştırarak
-- canlı bulut veritabanınızda Kariyer Ağı altyapısını oluşturabilirsiniz.

-- 1. İŞ & STAJ İLANLARI TABLOSU (job_postings)
CREATE TABLE IF NOT EXISTS public.job_postings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('İş', 'Staj')),
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Closed')) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Herkes ilanları görebilir
DROP POLICY IF EXISTS "Herkes ilanları görebilir" ON public.job_postings;
CREATE POLICY "Herkes ilanları görebilir" ON public.job_postings FOR SELECT USING (true);

-- Sadece giriş yapmış kullanıcılar (ve özellikle mezun/öğretmen/admin) ilan ekleyebilir
DROP POLICY IF EXISTS "Yetkili kullanıcılar ilan ekleyebilir" ON public.job_postings;
CREATE POLICY "Yetkili kullanıcılar ilan ekleyebilir" ON public.job_postings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- İlanı veren kişi kendi ilanını güncelleyebilir
DROP POLICY IF EXISTS "İlan sahipleri kendi ilanlarını güncelleyebilir" ON public.job_postings;
CREATE POLICY "İlan sahipleri kendi ilanlarını güncelleyebilir" ON public.job_postings FOR UPDATE USING (auth.uid() = employer_id);


-- 2. İLAN BAŞVURULARI TABLOSU (job_applications)
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  posting_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  resume_url TEXT NOT NULL,
  cover_letter TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(posting_id, applicant_id)
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi başvurularını veya kendi ilanlarına gelen başvuruları görebilir
DROP POLICY IF EXISTS "Kullanıcılar ilgili başvuruları görebilir" ON public.job_applications;
CREATE POLICY "Kullanıcılar ilgili başvuruları görebilir" ON public.job_applications FOR SELECT USING (
  auth.uid() = applicant_id 
  OR auth.uid() = (SELECT employer_id FROM public.job_postings WHERE id = posting_id)
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin'
);

-- Giriş yapmış tüm kullanıcılar başvuru gönderebilir
DROP POLICY IF EXISTS "Kullanıcılar başvuru yapabilir" ON public.job_applications;
CREATE POLICY "Kullanıcılar başvuru yapabilir" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- İlanı veren mezun (veya admin) başvurunun durumunu güncelleyebilir
DROP POLICY IF EXISTS "İlan sahipleri başvuruları güncelleyebilir" ON public.job_applications;
CREATE POLICY "Kullanıcılar başvuruyu güncelleyebilir" ON public.job_applications FOR UPDATE USING (
  auth.uid() = (SELECT employer_id FROM public.job_postings WHERE id = posting_id)
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin'
);


-- 3. ÖĞRENCİ STAJ TALEPLERİ TABLOSU (internship_requests)
CREATE TABLE IF NOT EXISTS public.internship_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  field TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Active', 'Closed')) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.internship_requests ENABLE ROW LEVEL SECURITY;

-- Herkes staj taleplerini görebilir
DROP POLICY IF EXISTS "Herkes staj taleplerini görebilir" ON public.internship_requests;
CREATE POLICY "Herkes staj taleplerini görebilir" ON public.internship_requests FOR SELECT USING (true);

-- Sadece giriş yapmış kullanıcılar (öğrenciler) staj talebinde bulunabilir
DROP POLICY IF EXISTS "Kullanıcılar staj talebinde bulunabilir" ON public.internship_requests;
CREATE POLICY "Kullanıcılar staj talebinde bulunabilir" ON public.internship_requests FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Talebi oluşturan öğrenci kendi talebini güncelleyebilir
DROP POLICY IF EXISTS "Talebi oluşturan öğrenci talebi güncelleyebilir" ON public.internship_requests;
CREATE POLICY "Talebi oluşturan öğrenci talebi güncelleyebilir" ON public.internship_requests FOR UPDATE USING (auth.uid() = student_id);
