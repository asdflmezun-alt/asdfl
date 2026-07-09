-- E-posta bildirim sisteminin veritabanı katmanı.
-- 1) profiles: kullanıcı başına e-posta tercihi (email_notifications) ve
--    abonelikten çıkma linkinde kullanılacak tahmin edilemez token
--    (email_unsub_token).
-- 2) notifications: hangi bildirimin e-postayla gönderildiğini işaretlemek
--    için emailed_at kolonu + gönderilmemiş bildirimleri hızlı bulmak için
--    kısmi index.
-- 3) İki fazlı gönderim tasarımı:
--      a) public.list_email_digests(batch_size) — Edge Function'ın periyodik
--         olarak çağıracağı, gönderilecek kullanıcı+bildirim gruplarını
--         DÖNDÜREN (işaretlemeyen) RPC.
--      b) public.mark_notifications_emailed(target_user_id, upto) — ilgili
--         kullanıcıya e-posta gönderimi BAŞARILI olduktan sonra Edge
--         Function'ın çağıracağı işaretleme RPC'si.
--    Bu ayrım sayesinde e-posta gönderimi sırasında bir hata olursa
--    bildirimler "gönderilmemiş" kalır ve bir sonraki batch'te tekrar denenir.
-- 4) public.email_unsubscribe(token) — abonelikten çıkma linki için, auth
--    gerektirmeyen ama yalnızca service_role'ün çağırdığı RPC.
-- 5) Üç RPC de yalnızca service_role'e açıktır: hepsi tüm kullanıcıların
--    e-posta adreslerini/tercihlerini döndürür ya da değiştirir, bu yüzden
--    yalnızca Edge Function (service_role anahtarıyla) çağırmalıdır.
--    authenticated'e KESİNLİKLE grant verilmez.
-- 6) email_unsub_token hiçbir role SELECT ile açılmaz ve public_profiles
--    görünümüne eklenmez: yalnızca SECURITY DEFINER fonksiyon gövdesi
--    (table owner yetkisiyle, ACL kontrolünden muaf) içinde okunur.
-- Tekrar çalıştırılabilir (idempotent).

-- ---- profiles: e-posta tercihleri ----
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_unsub_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Kullanıcı kendi e-posta bildirim tercihini okuyabilsin (profil ayarları ekranı).
-- UPDATE tarafında sütun bazlı bir kısıtlama yoktur; profiles üzerindeki genel
-- "kullanıcı kendi satırını günceller" politikası ve tetikleyicisi (role/mentor
-- hariç) zaten geçerlidir, bu yüzden burada ek bir UPDATE grant'ine gerek yok.
GRANT SELECT (email_notifications) ON public.profiles TO authenticated;

-- DİKKAT: email_unsub_token için hiçbir role (authenticated, anon) SELECT grant
-- verilmez ve public_profiles görünümüne eklenmez. profiles tablosunda SELECT
-- zaten sütun bazlı kısıtlanmıştır (bkz. 202606180001_security_hardening.sql:
-- "REVOKE SELECT ON public.profiles FROM anon, authenticated" + yalnızca
-- belirli sütunlara GRANT SELECT). Yeni eklenen bir sütun bu listeye dahil
-- edilmediği sürece otomatik olarak seçilebilir olmaz; token'ı yalnızca
-- SECURITY DEFINER RPC gövdeleri (service_role çağrısıyla) okuyabilir.

-- ---- notifications: e-posta gönderim takibi ----
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- Henüz e-postayla gönderilmemiş bildirimleri hızlı bulmak için kısmi index.
CREATE INDEX IF NOT EXISTS idx_notifications_unemailed
  ON public.notifications(user_id, created_at)
  WHERE emailed_at IS NULL;

-- ---- RPC 1: gönderilecek e-posta özetlerini listele (işaretlemez) ----
CREATE OR REPLACE FUNCTION public.list_email_digests(batch_size INTEGER DEFAULT 100)
RETURNS TABLE(user_id UUID, email TEXT, name TEXT, unsub_token UUID, notifications JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate_notifications AS (
    SELECT
      n.user_id, n.type, n.title, n.body, n.link, n.created_at,
      ROW_NUMBER() OVER (PARTITION BY n.user_id ORDER BY n.created_at DESC) AS rn
    FROM public.notifications n
    WHERE n.is_read = false AND n.emailed_at IS NULL
  ),
  per_user AS (
    SELECT
      c.user_id,
      jsonb_agg(
        jsonb_build_object(
          'type', c.type,
          'title', c.title,
          'body', c.body,
          'link', c.link,
          'created_at', c.created_at
        ) ORDER BY c.created_at ASC
      ) AS notifications
    FROM candidate_notifications c
    WHERE c.rn <= 20
    GROUP BY c.user_id
  )
  SELECT p.id, p.email, p.name, p.email_unsub_token, pu.notifications
  FROM per_user pu
  JOIN public.profiles p ON p.id = pu.user_id
  WHERE p.email_notifications = true AND p.email IS NOT NULL
  LIMIT LEAST(GREATEST(batch_size, 1), 500);
END;
$$;

-- ---- RPC 2: gönderimi başarılı olan bildirimleri işaretle ----
CREATE OR REPLACE FUNCTION public.mark_notifications_emailed(target_user_id UUID, upto TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.notifications
  SET emailed_at = NOW()
  WHERE user_id = target_user_id AND emailed_at IS NULL AND created_at <= upto;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- ---- RPC 3: abonelikten çıkma (unsubscribe) ----
-- Token tahmin edilemez (UUID) olduğu için kullanıcı kimlik doğrulaması
-- gerektirmez; yine de yalnızca Edge Function (service_role) çağırır.
CREATE OR REPLACE FUNCTION public.email_unsubscribe(token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.profiles SET email_notifications = false WHERE email_unsub_token = token;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

-- ---- Yetkiler ----
-- Bu üç RPC de tüm kullanıcıların e-posta adreslerini döndürür ya da e-posta
-- tercihlerini değiştirir; yalnızca Edge Function service_role anahtarıyla
-- çağırmalıdır. authenticated/anon rollerine KESİNLİKLE grant verilmez.
REVOKE ALL ON FUNCTION public.list_email_digests(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notifications_emailed(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_unsubscribe(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_email_digests(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notifications_emailed(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_unsubscribe(UUID) TO service_role;

-- ---- pg_cron zamanlaması ----
-- Edge Function'ı tetiklemek proje URL'si ve anon/service anahtarı gerektirir;
-- bu nedenle zamanlama (cron.schedule ile net/http çağrısı) burada değil,
-- deployment dokümantasyonunda ele alınacaktır (ayrı bir görev tarafından).
