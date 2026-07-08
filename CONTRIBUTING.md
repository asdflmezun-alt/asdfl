# Katkı Rehberi / Contributing Guide

*(English summary at the bottom.)*

ASDFL Mezunlar Derneği platformuna katkıda bulunmak istediğiniz için teşekkürler! Bu proje bir okul topluluğuna hizmet eden gönüllü bir çalışmadır; küçük düzeltmelerden yeni modüllere kadar her katkı değerlidir.

## Başlamadan önce

1. [Açık issue'lara](https://github.com/asdflmezun-alt/asdfl/issues) ve [ROADMAP.md](ROADMAP.md) dosyasına bakın — üzerinde çalışmak istediğiniz konu zaten tartışılıyor olabilir.
2. Büyük bir değişiklik planlıyorsanız önce bir issue açıp yaklaşımı tartışın; böylece emeğiniz boşa gitmez.
3. Küçük düzeltmeler (yazım hatası, kırık bağlantı, bariz bug) için doğrudan PR açabilirsiniz.

## Geliştirme ortamı

Gereksinimler: Node.js 20+ ve (veritabanı değişiklikleri için) Supabase CLI.

```bash
git clone https://github.com/asdflmezun-alt/asdfl.git
cd asdfl
npm install
npm run verify   # vendor hazırlığı + testler
npm run dev      # http://localhost:3000
```

Tam işlevsellik için kendi Supabase projenizi oluşturup `supabase/migrations` klasöründeki migrasyonları uygulamanız gerekir (`supabase db push`).

## Kod standartları

- **Vanilla JS, framework yok.** Mevcut sayfa bazlı yapıyı koruyun: her sayfanın kendi `js/<sayfa>.js` ve gerekiyorsa `css/<sayfa>.css` dosyası vardır; ortak mantık `js/app.js` içindedir.
- **CDN kullanmayın.** Üçüncü parti kütüphaneler yerel vendor dosyaları olarak tutulur (`npm run vendor`); testler CDN kullanımını reddeder.
- **Güvenlik önce gelir:**
  - Kullanıcı girdisini DOM'a yazmadan önce `js/bootstrap.js` içindeki temizleme yardımcılarını kullanın; ham `innerHTML` kullanmayın.
  - Yetkilendirme kararlarını asla istemci tarafında vermeyin — RLS politikaları ve RPC fonksiyonları esas kaynaktır.
  - Supabase service-role anahtarı hiçbir koşulda istemci koduna giremez.
- **Veritabanı değişiklikleri** yalnızca `supabase/migrations` altına yeni bir migrasyon dosyası olarak eklenir (`YYYYMMDDNNNN_aciklama.sql` formatında). Mevcut migrasyonlar düzenlenmez.
- Arayüz metinleri Türkçedir; kod, değişken adları ve commit mesajları Türkçe veya İngilizce olabilir.

## Test

Her PR'dan önce:

```bash
npm run verify
```

Güvenlikle ilgili bir davranış değiştiriyorsanız `tests/security.test.mjs` içine uygun bir test ekleyin.

## Pull request süreci

1. `main` üzerinden bir dal oluşturun (`fix/...`, `feat/...`).
2. Değişikliğinizi odaklı tutun — bir PR bir konu.
3. `npm run verify` yeşil olmalı.
4. PR açıklamasında **ne** değişti ve **neden** değişti, kısaca yazın; arayüz değişikliklerinde ekran görüntüsü ekleyin.
5. İlgili issue varsa `Fixes #<numara>` ile bağlayın.

## Güvenlik açığı bildirimi

Güvenlik açıklarını **public issue olarak açmayın** — [SECURITY.md](SECURITY.md) içindeki süreci izleyin.

---

## English summary

Contributions are welcome! Requirements: Node.js 20+ (and Supabase CLI for DB work). Run `npm install && npm run verify && npm run dev` to get started. Key rules: vanilla JS only (no frameworks), no CDNs (vendored libraries only), sanitize all user input via the helpers in `js/bootstrap.js`, never make authorization decisions client-side, and add schema changes only as new files under `supabase/migrations`. Run `npm run verify` before opening a PR, keep PRs focused, and link related issues. Report security vulnerabilities privately per [SECURITY.md](SECURITY.md), not as public issues.
