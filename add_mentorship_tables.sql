-- =======================================================
-- ASDFL MEZUNLAR DERNEĞİ - MENTÖRLÜK SİSTEMİ VERİTABANI ŞEMASI
-- =======================================================

-- 1. MENTÖRLÜK İLİŞKİLERİ TABLOSU
-- (Mentörler ve öğrenciler arasındaki eşleşmeleri saklar)
CREATE TABLE IF NOT EXISTS public.mentorships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Active', 'Completed', 'Cancelled')) DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(mentor_id, student_id)
);

-- RLS Aktifleştirme
ALTER TABLE public.mentorships ENABLE ROW LEVEL SECURITY;

-- Politikalar
DROP POLICY IF EXISTS "Kullanıcılar ilgili mentörlükleri görebilir" ON public.mentorships;
CREATE POLICY "Kullanıcılar ilgili mentörlükleri görebilir" 
  ON public.mentorships FOR SELECT 
  USING (auth.uid() = mentor_id OR auth.uid() = student_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Öğrenciler mentörlük talebi gönderebilir" ON public.mentorships;
CREATE POLICY "Öğrenciler mentörlük talebi gönderebilir" 
  ON public.mentorships FOR INSERT 
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Mentör veya Admin ilişkileri güncelleyebilir" ON public.mentorships;
CREATE POLICY "Mentör veya Admin ilişkileri güncelleyebilir" 
  ON public.mentorships FOR UPDATE 
  USING (auth.uid() = mentor_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "İlişkileri sadece Admin silebilir" ON public.mentorships;
CREATE POLICY "İlişkileri sadece Admin silebilir" 
  ON public.mentorships FOR DELETE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');


-- 2. MENTÖRLÜK TAKVİM / RANDEVULAR TABLOSU
-- (Görüşme randevularını saklar)
CREATE TABLE IF NOT EXISTS public.mentorship_appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL, -- örn: "15:30"
  duration INTEGER DEFAULT 45, -- dakika cinsinden
  status TEXT NOT NULL CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')) DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS Aktifleştirme
ALTER TABLE public.mentorship_appointments ENABLE ROW LEVEL SECURITY;

-- Politikalar
DROP POLICY IF EXISTS "Kullanıcılar ilgili randevuları görebilir" ON public.mentorship_appointments;
CREATE POLICY "Kullanıcılar ilgili randevuları görebilir" 
  ON public.mentorship_appointments FOR SELECT 
  USING (auth.uid() = mentor_id OR auth.uid() = student_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Mentör veya Öğrenci randevu ekleyebilir" ON public.mentorship_appointments;
CREATE POLICY "Mentör veya Öğrenci randevu ekleyebilir" 
  ON public.mentorship_appointments FOR INSERT 
  WITH CHECK (auth.uid() = mentor_id OR auth.uid() = student_id);

DROP POLICY IF EXISTS "İlgili kullanıcılar randevuyu güncelleyebilir" ON public.mentorship_appointments;
CREATE POLICY "İlgili kullanıcılar randevuyu güncelleyebilir" 
  ON public.mentorship_appointments FOR UPDATE 
  USING (auth.uid() = mentor_id OR auth.uid() = student_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

DROP POLICY IF EXISTS "Adminler veya Mentörler randevuları silebilir" ON public.mentorship_appointments;
CREATE POLICY "Adminler veya Mentörler randevuları silebilir" 
  ON public.mentorship_appointments FOR DELETE 
  USING (auth.uid() = mentor_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');
