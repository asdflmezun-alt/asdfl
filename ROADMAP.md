# Yol Haritası / Roadmap

Bu belge projenin planlanan gelişim yönünü özetler. Her başlık için GitHub'da bir issue açılması hedeflenir; katkıda bulunmak isteyenler ilgili issue üzerinden tartışmaya katılabilir. Sıralama önceliği yansıtır ancak kesin bir taahhüt değildir.

## Kısa vade

- [ ] **Ortak giriş/kayıt bileşeni** — Sayfalar arasında tekrar eden login/register modal kodunun tek bir paylaşılan bileşene alınması.
- [ ] **Topluluk moderasyonu iyileştirmeleri** — Rapor edilen içerik akışının yönetim paneliyle tam entegrasyonu (bkz. `supabase/migrations/202607040002_post_moderation.sql`).
- [ ] **Dokümantasyona ekran görüntüleri** — README ve PROJE_RAPORU'na rol bazlı kullanım senaryoları ve ekran görüntüleri eklenmesi.
- [ ] **Erişilebilirlik taraması** — Klavye navigasyonu, ARIA etiketleri ve kontrast kontrolü.
- [ ] **Profil: "Katıldığım etkinlikler" sekmesi** — Kullanıcının RSVP verdiği etkinliklerin profil sayfasında listelenmesi (`event_rsvps` üzerinden).
- [ ] **Topluluk etkinlik eki: canlı RSVP** — Topluluk akışındaki etkinlik ek kartına canlı katılımcı sayısı ve "Katıl" butonu; `etkinlikler.html#event-<id>` derin bağlantısı.
- [ ] **Etkinlik–galeri bağlantısı** — Galeri yüklemelerine opsiyonel `event_id`; geçmiş etkinlik kartında o etkinliğin fotoğrafları.
- [ ] **Etkinlik bekleme listesi** — Kontenjan dolduğunda sıraya yazma; iptal olunca sıradakine bildirim.

## Orta vade

- [ ] **End-to-end testler** — Kayıt, burs başvurusu, mentorluk ve admin akışları için tarayıcı tabanlı testler (mevcut testler güvenlik odaklıdır).
- [ ] **E-posta bildirimlerinde tür bazlı tercih** — Kullanıcının hangi bildirim türlerini (mentorluk, etkinlik, bahsetme…) e-posta ile alacağını ayrı ayrı seçebilmesi (günlük özet altyapısı tamamlandı, bkz. `docs/email-bildirimleri.md`).
- [ ] **Yönetim paneli UX iyileştirmeleri** — Toplu işlemler, arama/filtreleme, veri talebi akışının sadeleştirilmesi.
- [ ] **Migrasyon zincirinin belgelenmesi** — Şemanın tek migrasyon zinciri üzerinde temiz ve belgeli hale getirilmesi (topluluk tabloları için baseline eklendi; profiles, events, burs/kariyer tabloları eksik).
- [ ] **CSP sıkılaştırması** — Sayfalardaki inline `onclick` handler'ların event delegation'a taşınıp `script-src`'den `'unsafe-inline'`'ın çıkarılması (topluluk hashtag'lerinde başlandı).

## Uzun vade

- [ ] **Kurulum sihirbazı / şablonlaştırma** — Platformun başka okul ve derneklerin kendi örneklerini kolayca kurabileceği şekilde yapılandırılması (okul adı, logo, renkler, Supabase yapılandırması için tek yerden ayar).
- [ ] **Çok dillilik (i18n)** — Arayüz metinlerinin ayrıştırılarak Türkçe dışında dillere çeviri desteği.
- [ ] **PWA iyileştirmeleri** — Çevrimdışı destek ve push bildirimlerinin genişletilmesi (`sw.js` üzerine).

## Tamamlananlar

- [x] Güvenlik sertleştirme migrasyonları ve `public_profiles` görünümü
- [x] Topluluk akışı: paylaşım, beğeni, yorum, hedef kitle seçimi
- [x] Burs, mentorluk ve kariyer modülleri
- [x] KVKK uyum sayfaları ve veri talebi akışı
- [x] Güvenlik regresyon testleri ve CSP başlıkları
- [x] Etkinlikler sistemi: RSVP ("Katılıyorum"), katılımcı avatar duvarı, kontenjan, geri sayım
- [x] Takvime ekleme: Google Takvim + Apple/Outlook (.ics), mobil ve masaüstü
- [x] Etkinlik bildirimleri: yeni etkinlik duyurusu + ertesi gün hatırlatması (pg_cron)
- [x] Yönetim: kontenjan/saat/kapak alanları, katılım sayısı, katılımcı CSV dışa aktarımı
- [x] E-posta bildirim sistemi: günlük özet (digest), Resend + Edge Function, tek tık abonelik iptali, profilde tercih anahtarı
