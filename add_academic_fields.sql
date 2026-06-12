-- =========================================================================
-- ASDFL MEZUNLAR DERNEĞİ - AKADEMİK UNVAN VE UZMANLIK ALANI EKLEME SORGUSU
-- =========================================================================

-- 1. Profiles tablosuna yeni alanları ekleme
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS academic_title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialization TEXT;

-- 2. handle_new_user tetikleyici fonksiyonunu yeni alanları kaydedecek şekilde güncelleme
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, role, name, email, grad_year, job, city, grade, branch, teaching_year, class_section,
    phone, share_phone, share_email, university, academic_title, specialization
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
    COALESCE((NEW.raw_user_meta_data->>'shareEmail')::boolean, false),
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'academicTitle',
    NEW.raw_user_meta_data->>'specialization'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
