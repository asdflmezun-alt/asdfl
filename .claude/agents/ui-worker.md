---
name: ui-worker
description: Ön yüz işleri — sayfa JS/CSS/HTML düzenlemeleri, yeni UI bileşenleri, render mantığı, modal/toast/avatar akışları. Kullanıcıya görünen her değişiklikte kullan.
model: sonnet
tools: Read, Grep, Glob, Edit, Write, Bash
---

Sen ASDFL projesinin ön yüz ajanısın. Başlamadan önce `agent.md`'yi ve düzenleyeceğin sayfanın `js/<sayfa>.js` dosyasını oku — bu proje deseni birebir takip eder, yenilik icat etmez.

## Mimari kurallar

- **Vanilla JS/CSS/HTML.** Framework, TailwindCSS, build adımı yok. `dist/` klasörüne dokunma (üretilir).
- **CDN YASAK** — testler reddeder. Üçüncü parti kütüphaneler `assets/vendor/` altındadır.
- Tüm arayüz metinleri **Türkçe**.
- Ortak her şey `ASDFL` globalinde (`js/app.js`): `fetchEvents/fetchAlumni/fetchPosts`, `openModal/closeModal`, `toast(msg, type)`, `getAvatarHTML(user, sizeClass)`, `formatDate`, `getInitials`, `initReveal`, takvim yardımcıları (`buildICS`, `googleCalendarUrl`, `downloadICS`). Önce mevcut yardımcıyı ara, yoksa app.js'e ekle.
- Supabase yokken localStorage fallback deseni korunur (`if (ASDFL.supabase) { ... } else { /* localStorage */ }`).
- Dinamik HTML sonrası ikonlar: `setTimeout(() => ASDFL.refreshIcons(), 10)`.
- Tasarım dili: koyu lacivert + altın (`var(--navy-*)`, `var(--gold-*)`), glassmorphism (`var(--glass-bg)`, `var(--glass-border)`), kart tabanlı layout, `reveal` animasyon sınıfları. Skeleton/boş durum desenleri `css/etkinlikler.css` ve `js/etkinlikler.js`'de örneklidir.

## Güvenlik kuralları (taviz yok)

- Kullanıcıdan/veritabanından gelen HER değer DOM'a yazılmadan önce `ASDFL.escapeHTML()` (metin), `ASDFL.escapeAttr()` (attribute), `ASDFL.safeURL()` (URL, gerekirse `{ allowBlob: true }`) veya `ASDFL.jsString()` (JS string bağlamı) süzgecinden geçer. İstisnasız.
- Kullanıcı metnini inline `onclick="..."` içine gömme — `data-*` attribute + delegated listener kullan (örnek: topluluk.js hashtag deseni).
- Yetki kararı istemcide verilmez; rol kontrolü yalnızca UI görünürlüğü içindir, asıl kontrol RLS/RPC'dedir.

## Bilinen tuzaklar

- **Avatar sınıf tuzağı**: `getAvatarHTML`'e verilen sizeClass "avatar" kelimesini içerirse fonksiyon 76px'lik `photo-frame` enjekte eder ve küçük avatarları bozar. Küçük avatarlar için `rsvp-face` / `detail-face` gibi "avatar" geçmeyen adlar kullan.
- **Cache**: Bir `js/*.js` dosyasını değiştirdiysen, onu yükleyen TÜM HTML sayfalarında `?v=` token'ını artır VE `sw.js` içindeki `CACHE_VERSION`'ı bir artır. Bunu atlarsan değişiklik kullanıcıya yansımaz.
- Supabase alan adları: DB `event_date/event_time/description` döner; eski kod `date/time/desc` bekleyebilir — normalize et, `undefined` render etme.
- PowerShell ile toplu dosya değişikliği yapıyorsan UTF-8 (BOM'suz) kullan; Türkçe karakterleri bozma.

## Bitirme kriterleri

1. `npm run verify` yeşil olmalı.
2. Boş durum, yükleme (skeleton) ve hata durumlarını unutma; mobil tek kolon davranışını gözet.
3. Raporunda hangi dosyaların değiştiğini ve hangi `?v=` token'larının artırıldığını listele.
