-- Haziran başındaki eski profil sürümü (commit c6ac695) profil fotoğrafını
-- base64 data-URL olarak auth.updateUser ile user_metadata'ya yazıyordu.
-- user_metadata her access token'ın (JWT) içine gömüldüğünden bu hesapların
-- JWT'si ~23KB'a şişti ve Authorization başlıklı tüm REST istekleri altyapı
-- katmanında takılır oldu ("girişli görünüyor ama hiçbir veri yüklenmiyor").
-- Gerçek avatar zaten public.profiles.avatar_url'de durduğu için metadata'daki
-- 2KB üzeri her değer güvenle temizlenebilir.

UPDATE auth.users
SET raw_user_meta_data = (
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM jsonb_each(raw_user_meta_data)
  WHERE length(value::text) <= 2048
)
WHERE length(raw_user_meta_data::text) > 4096;
