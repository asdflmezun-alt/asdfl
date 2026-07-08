# Güvenlik Politikası / Security Policy

Bu platform gerçek kişilerin (mezun, öğrenci, öğretmen) kişisel verilerini işler; güvenlik bildirimleri ciddiyetle ele alınır.

## Güvenlik açığı bildirimi

Bir güvenlik açığı bulduysanız lütfen **public issue açmayın**. Bunun yerine:

1. GitHub'ın [private vulnerability reporting](https://github.com/asdflmezun-alt/asdfl/security/advisories/new) özelliğini kullanın, **veya**
2. Repo yöneticisine GitHub profili üzerinden özel olarak ulaşın.

Bildiriminizde etkilenen sayfa/dosya, yeniden üretme adımları ve olası etkiyi belirtin. Amaç 7 gün içinde ilk yanıtı vermektir.

## Kapsam

Özellikle şu alanlardaki bulgular kritiktir:

- Row Level Security (RLS) politikalarını aşan veri erişimi
- Yetki yükseltme (öğrenci → mentor/admin vb.)
- `public_profiles` görünümü dışından hassas iletişim verisine (e-posta, telefon) erişim
- Stored/reflected XSS ve CSP atlatma
- Supabase Storage kurallarını aşan dosya yükleme

## Mevcut güvenlik katmanları

- Supabase RLS politikaları + admin yetkilerinin RPC üzerinden doğrulanması
- `js/bootstrap.js` içinde erken aşama HTML/URL temizleme
- `_headers` içinde CSP, HSTS, X-Frame-Options ve diğer güvenlik başlıkları
- CDN yasağı — tüm üçüncü parti kütüphaneler yerel vendor kopyasıdır
- `tests/security.test.mjs` içinde otomatik güvenlik regresyon testleri (`npm test`)

---

**English:** This platform processes real personal data. Please do not open public issues for vulnerabilities — use GitHub's private vulnerability reporting instead. High-priority scopes: RLS bypasses, privilege escalation, exposure of private contact data, XSS/CSP bypasses, and storage rule bypasses. First response target: 7 days.
