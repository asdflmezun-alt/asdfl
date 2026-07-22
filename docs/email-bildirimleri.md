# E-posta Bildirimleri — Kurulum ve İşletim

## 1. Mimari özet

`public.notifications` tablosuna düşen her yeni bildirim (yorum, mentörlük talebi, başvuru
durumu vb.) doğrudan e-posta göndermez; yalnızca veritabanında birikir. Günde bir kez
(zamanlanmış görev ile) `send-email-digest` fonksiyonu çalışır, `list_email_digests` RPC'si
ile her kullanıcının okunmamış/e-postalanmamış bildirimlerini (en fazla 20) toplu olarak
çeker, tek bir "günlük özet" e-postası halinde Resend üzerinden gönderir ve başarılı
gönderimden sonra `mark_notifications_emailed` ile o kullanıcının bildirimlerini işaretler.
Böylece her bildirim için ayrı e-posta atılmaz, kullanıcı günde en fazla bir özet alır ve
gönderim başarısız olursa bir sonraki çalışmada aynı bildirimler tekrar denenir.

## 2. Resend hesabı, domain doğrulama ve API anahtarı

1. https://resend.com adresinden ücretsiz bir hesap oluştur.
2. Dashboard → **Domains** → **Add Domain** ile derneğin gönderim yapacağı alan adını
   (örn. `asdfl.org`) ekle. Resend'in verdiği SPF/DKIM (ve varsa DMARC) DNS kayıtlarını
   alan adının DNS yönetim panelinden ekle. Doğrulama birkaç dakika ile birkaç saat
   sürebilir; Dashboard'da domain durumu "Verified" olana kadar bekle.
   - Domain doğrulaması bitene kadar test amaçlı Resend'in sağladığı `onboarding@resend.dev`
     gönderen adresini kullanabilirsin, ancak gerçek kullanıcılara toplu gönderim için
     kendi doğrulanmış domain'in şart (aksi halde e-postalar spam'e düşer veya reddedilir).
3. Dashboard → **API Keys** → **Create API Key** ile "Sending access" yetkili bir anahtar
   oluştur ve güvenli bir yere kaydet (bir daha tam haliyle gösterilmez).

## 3. Supabase sırlarını (secrets) ayarlama

Proje kökünde, Supabase CLI ile giriş yapmış ve projeye bağlanmış olarak:

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx... \
  FROM_EMAIL="ASDFL Mezunlar Derneği <info@asdfl.org>" \
  SITE_URL=https://www.asdflmezun.org
```

Notlar:
- `FROM_EMAIL`, Resend'de doğruladığın domain ile aynı domain'i kullanmalı
  (örn. `info@asdfl.org`), aksi halde gönderim reddedilir.
- `SITE_URL` sonunda `/` **olmadan** girilmeli; fonksiyon bildirim linklerini
  `SITE_URL + "/" + link` olarak birleştirir (örn. `https://www.asdflmezun.org/topluluk.html#post-42`).
- `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Supabase tarafından fonksiyona otomatik
  sağlanır; bunları ayrıca `secrets set` ile eklemene gerek yok.

## 4. Deploy

```bash
supabase functions deploy send-email-digest --no-verify-jwt
```

**`--no-verify-jwt` neden şart:** Fonksiyonun içinde iki rota var. Zamanlanmış (cron)
tetiklenen digest gönderim rotası service-role anahtarıyla çağrılır, ama e-postanın
içindeki **"E-posta bildirimlerini kapat"** linki kullanıcı tarafından, tarayıcıda,
**oturum açmadan** doğrudan tıklanır (`GET .../send-email-digest?action=unsubscribe&token=...`).
Bu istekte hiçbir `Authorization: Bearer <kullanıcı JWT'si>` header'ı yoktur; Supabase'in
varsayılan JWT doğrulaması bu isteği 401 ile reddeder. Güvenlik JWT doğrulamasından değil,
`token` parametresinin veritabanında saklanan, tahmin edilemeyen bir UUID (`unsub_token`)
olmasından ve `email_unsubscribe` RPC'sinin bu token'ı doğrulamasından gelir — tıpkı birçok
e-posta servisinin "abonelikten çık" linklerinde olduğu gibi.

## 5. Zamanlama (günlük 09:00)

### Seçenek A — Supabase Dashboard (önerilen, basit)

1. Dashboard → **Integrations** (veya **Edge Functions** → ilgili fonksiyon) → **Cron**.
2. Yeni bir zamanlama ekle:
   - Fonksiyon: `send-email-digest`
   - Cron ifadesi: `0 9 * * *` (her gün 09:00, proje saat dilimi genelde UTC — Türkiye
     saatiyle 12:00 karşılığını istiyorsan `0 6 * * *` kullan, UTC+3 kabul edilerek).
   - HTTP metodu: `POST`, gövde boş (`action` parametresi verilmediği için otomatik
     digest rotasına düşer).

### Seçenek B — `pg_cron` + `pg_net` (SQL şablonu)

Supabase Dashboard → **Database** → **Extensions** üzerinden `pg_cron` ve `pg_net`
uzantılarını etkinleştirdikten sonra, SQL editöründe çalıştır (placeholder'ları doldur):

```sql
-- <PROJE_REF>, <SERVICE_ROLE_KEY> yerlerini kendi proje bilgilerinle değiştir.
select cron.schedule(
  'send-email-digest-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJE_REF>.supabase.co/functions/v1/send-email-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

`<SERVICE_ROLE_KEY>` gizli bir değerdir; bu SQL'i yalnızca Dashboard'un SQL editöründe
(veya sırları güvenli tutabileceğin bir yerde) çalıştır, repoya asla açık biçimde commitleme.

## 6. Elle test

Fonksiyonu deploy ettikten sonra manuel tetiklemek için:

```bash
curl -X POST \
  "https://<PROJE_REF>.supabase.co/functions/v1/send-email-digest" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

Beklenen yanıt: `{"sent":N,"failed":0,"skipped":M}` biçiminde bir JSON.

**Tek kullanıcıda deneme önerisi:** Prod verisiyle toplu göndermeden önce, test/staging
ortamında (veya prod'da geçici olarak) yalnızca kendi hesabına ait 1-2 bildirim üretip
(örn. kendine bir mentörlük talebi veya yorum bildirimi düşürerek) fonksiyonu tetikle,
kendi e-postana gelen özeti ve "abonelikten çık" linkinin doğru çalıştığını doğrula.
Abonelikten çıkma linkini test ederken tarayıcıda doğrudan açman yeterli:

```bash
curl "https://<PROJE_REF>.supabase.co/functions/v1/send-email-digest?action=unsubscribe&token=<unsub_token>"
```

Bu isteğe **Authorization header eklemene gerek yoktur** — fonksiyon `--no-verify-jwt` ile
deploy edildiği için ve güvenlik zaten token'da.

## 7. KVKK notu ve dağıtım sırası

- Bildirim tercihi varsayılan olarak **açıktır**: bir kullanıcı hesap oluşturduğunda,
  platform içi etkileşimleriyle ilgili (yorum, mentörlük, başvuru durumu vb.) e-posta
  bildirimleri almaya otomatik dahil olur. Bu, üyelik sözleşmesi kapsamında hizmetin
  işleyişine dair bilgilendirme niteliğindedir.
- Her digest e-postasında **tek tıkla iptal** linki bulunur (`action=unsubscribe`),
  oturum gerektirmez ve anında etkilidir.
- Kullanıcı ayrıca **profil sayfasından** (`profil.html`) bildirim tercihini istediği an
  değiştirebilir/yeniden açabilir.
- Bu iki mekanizma (tek tık iptal + profil sayfası yönetimi), kullanıcının kişisel
  verilerinin işlenmesine (e-posta ile iletişim) itiraz etme ve bu işlemeyi kolayca
  durdurma hakkını karşılar.

**Dağıtım sırası önemlidir:**
1. Önce migration'ı uygula: `supabase db push` (bu, `list_email_digests`,
   `mark_notifications_emailed`, `email_unsubscribe` RPC'lerini ve `unsub_token` alanını
   veritabanına ekler).
2. Ardından bu fonksiyonu deploy et: `supabase functions deploy send-email-digest --no-verify-jwt`.

Sıra tersine çevrilirse (önce fonksiyon, sonra migration), fonksiyon henüz var olmayan
RPC'leri çağırmaya çalışır ve hata verir; kalıcı bir sorun değildir, migration
tamamlandığında fonksiyon normal çalışmaya başlar. Yine de karışıklığı önlemek için
sıralamaya uyulması önerilir.
