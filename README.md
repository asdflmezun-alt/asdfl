# ASDFL Mezunlar Derneği Platformu

> **English summary:** An open-source alumni network platform built for Afyon Süleyman Demirel Science High School (ASDFL) in Türkiye. It connects alumni, current students, teachers and the alumni association on a single platform: a searchable alumni directory, scholarship applications, mentorship matching, a career/internship board, community feed, events and photo gallery. Built as a static multi-page app (HTML/CSS/vanilla JS) on top of Supabase (auth, Postgres with RLS, storage), so any school or nonprofit can self-host it at near-zero cost. Licensed under MIT.

Afyon Süleyman Demirel Fen Lisesi mezunları, öğrencileri, öğretmenleri ve dernek yönetimini tek bir dijital platformda buluşturan açık kaynaklı mezun ağı uygulaması.

## Sosyal fayda ve hedef kitle

Bu platform ticari bir ürün değildir; bir okul topluluğunun dayanışma ağını dijitalleştirmek için geliştirilmiştir:

- **Öğrenciler** — burs başvurusu yapar, hedefledikleri üniversite/mesleğe göre mezunlarla eşleşip mentorluk alır, staj ve kariyer fırsatlarını takip eder. Özellikle maddi imkânı kısıtlı öğrencilerin burs ve mentorluk süreçlerine erişimini kolaylaştırır.
- **Mezunlar** — aranabilir mezun rehberinde yer alır, mentorluk verir, iş/staj ilanı paylaşır, topluluk akışında ve etkinliklerde buluşur.
- **Öğretmenler** — topluluk ağına dahil olur, öğrenci-mezun bağlantılarına aracılık eder.
- **Dernek yönetimi** — üye, etkinlik, burs programı, başvuru, duyuru ve KVKK veri taleplerini tek panelden yönetir; kâğıt üzerinde yürüyen operasyon dijitalleşir.

Kod tabanı tek bir okula özgü değildir: statik ön yüz + Supabase mimarisi sayesinde **herhangi bir okul, mezun derneği veya kâr amacı gütmeyen topluluk** kendi örneğini düşük maliyetle (ücretsiz statik hosting + Supabase free tier) kurabilir.

## Özellikler

- 🔍 **Mezun rehberi** — isim, mezuniyet yılı, şehir, üniversite, uzmanlık ve mentorluk durumuna göre filtrelenebilir dizin; Leaflet tabanlı mezun haritası
- 🎓 **Burs modülü** — burs programları, öğrenci başvuruları ve yönetim onay akışı
- 🤝 **Mentorluk** — talep oluşturma, mentor eşleşmesi, randevu planlama
- 💼 **Kariyer ağı** — iş ilanları, staj talepleri ve başvuru takibi
- 💬 **Topluluk akışı** — paylaşım, beğeni, yorum; hedef kitleye göre yayınlama ve moderasyon
- 📅 **Etkinlikler ve duyurular**, 🖼️ **fotoğraf galerisi**
- 🛡️ **Yönetim paneli** — üyeler, roller, başvurular, duyurular, veri talepleri
- ⚖️ **KVKK uyumluluğu** — aydınlatma metni, açık rıza, çerez politikası, veri başvuru/silme akışları

## Teknik mimari

| Katman | Teknoloji |
|---|---|
| Ön yüz | Statik HTML + CSS + vanilla JavaScript (çok sayfalı) |
| Kimlik doğrulama, veritabanı, depolama | [Supabase](https://supabase.com) (Postgres + Row Level Security) |
| Harita / ikonlar | Leaflet, Lucide (yerel vendor kopyaları, CDN yok) |
| Dağıtım | `dist/` çıktısıyla herhangi bir statik hosting (Netlify, Cloudflare Pages vb.) |

Güvenlik yaklaşımı: RLS politikaları, admin yetkilerinin RPC üzerinden doğrulanması, `public_profiles` görünümüyle hassas iletişim verisinin paylaşım tercihine göre sınırlanması, CSP ve diğer güvenlik başlıkları (`_headers`), erken aşama XSS temizleme (`js/bootstrap.js`) ve `tests/security.test.mjs` içindeki otomatik güvenlik regresyon testleri. Ayrıntı için [SECURITY.md](SECURITY.md).

## Kurulum

Gereksinimler: Node.js 20+, [Supabase CLI](https://supabase.com/docs/guides/cli) (veritabanı için).

```bash
npm install
npm run verify   # vendor dosyalarını hazırlar + güvenlik testlerini çalıştırır
npm run dev      # http://localhost:3000
```

Veritabanı şemasının tek doğru kaynağı `supabase/migrations` klasörüdür:

```bash
supabase db push
```

Kök dizindeki SQL dosyaları tarihsel referanstır; yeni ortamlara tek başına uygulanmamalıdır. Migrasyonları önce bir staging Supabase projesinde deneyin, sonra üretime alın. **Supabase service-role anahtarını asla istemci tarafında kullanmayın.** Barındırma platformu `_headers` dosyasını desteklemiyorsa aynı başlıkları platformun kendi yapılandırmasına taşıyın.

Dağıtım çıktısı için:

```bash
npm run build    # dist/ klasörünü üretir
```

## Proje yapısı

```
├── *.html                  # Sayfalar (mezunlar, topluluk, burs, kariyer, yönetim…)
├── js/                     # Sayfa bazlı scriptler + app.js (ortak katman) + bootstrap.js (güvenlik)
├── css/                    # Ortak tasarım sistemi + sayfa bazlı stiller
├── supabase/migrations/    # Veritabanı şemasının tek doğru kaynağı
├── tests/                  # Güvenlik odaklı otomatik testler (npm test)
├── scripts/                # Vendor kopyalama ve dist build scriptleri
└── _headers                # CSP ve diğer üretim güvenlik başlıkları
```

Daha ayrıntılı mimari anlatım için [PROJE_RAPORU.md](PROJE_RAPORU.md).

## Katkıda bulunma

Katkılara açığız — kurulum, kod standartları ve PR süreci için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın. Yol haritası için [ROADMAP.md](ROADMAP.md) ve [açık issue'lara](https://github.com/asdflmezun-alt/asdfl/issues) göz atın. Topluluk beklentileri [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) içinde tanımlıdır.

## Lisans

Bu proje [MIT lisansı](LICENSE) ile lisanslanmıştır.
