-- user_metadata erişim belirtecine eklendiği için büyük değerler tüm kimlikli
-- isteklerin başlıklarını şişirebilir. Sınırı JSON'un UTF-8 bayt boyutuna göre
-- auth.users'a yazılmadan önce uygula.

CREATE OR REPLACE FUNCTION public.enforce_user_metadata_size_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF octet_length(COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)::text) > 8192 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22001',
      MESSAGE = 'Kullanıcı metadata alanı 8192 bayt sınırını aşıyor';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_user_metadata_size_limit()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_user_metadata_size_on_insert ON auth.users;
CREATE TRIGGER enforce_user_metadata_size_on_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_metadata_size_limit();

DROP TRIGGER IF EXISTS enforce_user_metadata_size_on_update ON auth.users;
CREATE TRIGGER enforce_user_metadata_size_on_update
  BEFORE UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_metadata_size_limit();

COMMENT ON FUNCTION public.enforce_user_metadata_size_limit() IS
  'auth.users.raw_user_meta_data alanını 8192 UTF-8 baytıyla sınırlar.';
