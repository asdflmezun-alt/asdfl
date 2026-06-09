-- ====================================================================
-- ASDFL MEZUNLAR DERNEĞİ - ÜYE SİLME SQL TANIMLAMALARI
-- ====================================================================

-- 1. Güvenli Üye Silme Fonksiyonu (RPC)
-- (Sadece Admin yetkisine sahip kullanıcılar tarafından çağrılabilir, auth.users tablosundan siler)
CREATE OR REPLACE FUNCTION public.delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- İstemi gönderen kullanıcının Admin rolünde olup olmadığını kontrol et
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin' THEN
    -- Kullanıcıyı auth.users'dan sil (profiles tablosu ON DELETE CASCADE ile bağlı olduğundan orası da silinecektir)
    DELETE FROM auth.users WHERE id = target_user_id;
  ELSE
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok. Yalnızca yöneticiler üye silebilir.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Profiles Tablosu İçin Doğrudan Silme RLS Politikası (Yedek/Fallback)
-- (Adminlerin doğrudan profiles tablosundan da satır silebilmesini sağlar)
DROP POLICY IF EXISTS "Adminler tüm profilleri silebilir" ON public.profiles;
CREATE POLICY "Adminler tüm profilleri silebilir" 
  ON public.profiles FOR DELETE 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');
