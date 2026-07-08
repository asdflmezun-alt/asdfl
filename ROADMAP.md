# Yol Haritası / Roadmap

Bu belge projenin planlanan gelişim yönünü özetler. Her başlık için GitHub'da bir issue açılması hedeflenir; katkıda bulunmak isteyenler ilgili issue üzerinden tartışmaya katılabilir. Sıralama önceliği yansıtır ancak kesin bir taahhüt değildir.

## Kısa vade

- [ ] **Ortak giriş/kayıt bileşeni** — Sayfalar arasında tekrar eden login/register modal kodunun tek bir paylaşılan bileşene alınması.
- [ ] **Topluluk moderasyonu iyileştirmeleri** — Rapor edilen içerik akışının yönetim paneliyle tam entegrasyonu (bkz. `supabase/migrations/202607040002_post_moderation.sql`).
- [ ] **Dokümantasyona ekran görüntüleri** — README ve PROJE_RAPORU'na rol bazlı kullanım senaryoları ve ekran görüntüleri eklenmesi.
- [ ] **Erişilebilirlik taraması** — Klavye navigasyonu, ARIA etiketleri ve kontrast kontrolü.

## Orta vade

- [ ] **End-to-end testler** — Kayıt, burs başvurusu, mentorluk ve admin akışları için tarayıcı tabanlı testler (mevcut testler güvenlik odaklıdır).
- [ ] **Bildirim sistemi genişletmesi** — E-posta bildirimleri (başvuru sonucu, mentorluk randevusu, yeni ilan).
- [ ] **Yönetim paneli UX iyileştirmeleri** — Toplu işlemler, arama/filtreleme, veri talebi akışının sadeleştirilmesi.
- [ ] **Migrasyon zincirinin belgelenmesi** — Şemanın tek migrasyon zinciri üzerinde temiz ve belgeli hale getirilmesi.

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
