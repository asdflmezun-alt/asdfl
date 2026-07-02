# ASDFL Mezunlar Dernegi Proje Raporu

## 1. Proje Tanimi

ASDFL Mezunlar Dernegi projesi, Afyon Suleyman Demirel Fen Lisesi mezunlari, ogrencileri, ogretmenleri ve dernek yonetimini tek bir dijital platformda bulusturmak icin gelistirilmis web tabanli bir mezun agi uygulamasidir. Platformun temel amaci okul toplulugunun iletisimini guclendirmek, mezun-ogrenci dayanismasini desteklemek, burs ve mentorluk sureclerini dijitallestirmek, etkinlikleri duyurmak ve dernek yonetiminin operasyonel islerini kolaylastirmaktir.

Proje statik HTML, CSS ve JavaScript dosyalari uzerine kuruludur; kimlik dogrulama, veritabani, dosya depolama ve yetkilendirme ihtiyaclari icin Supabase kullanir. Uygulama Netlify benzeri statik barindirma ortamlarina dagitilabilecek sekilde `dist/` cikti klasoru uretebilir.

## 2. Projenin Amaci

Bu projenin ana hedefleri sunlardir:

- Mezunlarin profil bilgileriyle aranabilir ve filtrelenebilir bir rehber olusturmak.
- Ogrencilerin mezunlardan mentorluk, kariyer ve burs destegi alabilmesini saglamak.
- Dernek etkinlikleri, duyurulari ve topluluk paylasimlarini merkezi bir alanda yayinlamak.
- Galeri ve ani paylasimlari ile okul aidiyetini canli tutmak.
- Kariyer ilani, staj talebi ve basvuru sureclerini platform icinden yonetmek.
- Yonetim paneliyle uye, etkinlik, burs, basvuru ve veri taleplerinin kontrolunu saglamak.
- KVKK, acik riza, gizlilik, cerez ve kullanim kosullari gibi yasal gereklilikleri uygulamaya dahil etmek.

## 3. Hedef Kullanici Gruplari

Platform dort ana kullanici grubu etrafinda tasarlanmistir:

- Mezunlar: Profil olusturabilir, mezun rehberinde yer alabilir, mentorluk verebilir, is/staj firsatlari paylasabilir, topluluk paylasimlari yapabilir.
- Ogrenciler: Burs basvurusu yapabilir, mentorluk talebi olusturabilir, hedef universite ve mesleklerine gore mezunlarla eslesebilir, staj ve kariyer firsatlarini takip edebilir.
- Ogretmenler: Topluluk agina dahil olabilir, profil bilgileriyle platformda temsil edilebilir.
- Admin/Yonetim: Uyeleri, etkinlikleri, burs programlarini, basvurulari, duyurulari ve veri taleplerini yonetebilir.

## 4. Ana Moduller

### 4.1 Ana Sayfa

`index.html` uygulamanin giris sayfasidir. Dernegin amacini tanitir, mezun rehberi, burs, mentorluk, galeri, etkinlikler ve topluluk modullerine yonlendirme yapar. Ayrica one cikan mezunlar, etkinlikler, topluluk akisindan paylasimlar ve mezun haritasi gibi dinamik alanlar icerir.

### 4.2 Mezun Rehberi

`mezunlar.html` ve `js/mezunlar.js` mezunlarin listelenmesini, filtrelenmesini ve incelenmesini saglar. Kullanici isim, mezuniyet yili, sehir, universite, uzmanlik ve mentorluk durumuna gore arama yapabilir. Mezun kartlari profil, iletisim ve mentorluk aksiyonlariyla desteklenir.

### 4.3 Topluluk

`topluluk.html` ve `js/topluluk.js` topluluk akisinin merkezidir. Kullanici paylasim yapabilir, begeni ve yorum ekleyebilir, hedef kitleye gore paylasim yayinlayabilir. Foto/video baglantisi gibi ekler icin de istemci tarafi destek bulunur.

### 4.4 Etkinlikler ve Duyurular

`etkinlikler.html` ve `js/etkinlikler.js` dernek etkinliklerini ve duyurularini listeler. Yaklasan/gecmis etkinlik ayrimi, etkinlik kartlari ve yonetim paneliyle entegre icerik yapisi vardir.

### 4.5 Galeri

`galeri.html` ve `js/galeri.js` okul ve dernek anilarinin fotograf olarak paylasilmasini saglar. Supabase Storage ile galeri gorselleri yuklenir; yukleme tarafinda dosya turu ve boyut sinirlari uygulanir.

### 4.6 Burs ve Mentorluk

`burs-mentorluk.html`, `js/burs.js`, `mentorluk.html` ve `js/mentorluk.js` burs programlari ile mentorluk sureclerini kapsar. Ogrenciler burs basvurusu yapabilir, mentor talep edebilir; mentorlar gelen talepleri kabul veya reddedebilir, gorusme planlayabilir ve sureci takip edebilir.

### 4.7 Kariyer Agi

`kariyer.html` ve `js/kariyer.js` is ilani, staj talebi, basvuru ve isveren/mezun tarafli yonetim akisini icerir. Mezunlar is veya staj firsati yayinlayabilir; ogrenciler ve diger kullanicilar uygun firsatlara basvurabilir.

### 4.8 Ogrenci Paneli

`ogrenci.html` ve `js/ogrenci.js` ogrencinin kendi durumunu takip ettigi paneldir. Burs basvurulari, mentorluk talepleri, staj/kariyer basvurulari ve hedefleriyle uyumlu mezun onerileri burada toplanir.

### 4.9 Profil

`profil.html` kullanicinin kendi bilgilerini duzenlemesini saglar. Profil alanlari role gore degisir; mezun, ogrenci ve ogretmen icin farkli bilgi ihtiyaclari desteklenir.

### 4.10 Yonetim Paneli

`yonetim.html` ve `js/yonetim.js` admin operasyonlari icin kullanilir. Uye rolleri, mentor yetkileri, etkinlikler, burs programlari, basvurular, duyurular ve veri talepleri bu panelden yonetilir.

## 5. Teknik Mimari

Proje, klasik cok sayfali statik web uygulamasi mimarisine sahiptir:

- On yuz: HTML, CSS ve vanilla JavaScript.
- Ortak uygulama katmani: `js/app.js`.
- Guvenli erken yukleme yardimcilari: `js/bootstrap.js`.
- Sayfa bazli JavaScript dosyalari: `js/home.js`, `js/mezunlar.js`, `js/topluluk.js`, `js/kariyer.js`, `js/mentorluk.js` vb.
- Stil dosyalari: `css/main.css` ortak tasarim sistemi, sayfa bazli CSS dosyalari ve animasyon dosyalari.
- Ucuncu parti kutuphaneler: Supabase JS, Leaflet ve Lucide yerel vendor dosyalari olarak tutulur.
- Dagitim: `npm run build` komutu vendor dosyalarini kopyalar ve statik siteyi `dist/` klasorune hazirlar.

`package.json` icinde temel komutlar su sekildedir:

- `npm run vendor`: Gerekli vendor dosyalarini yerel assets klasorune kopyalar.
- `npm run build`: Dagitim icin `dist/` klasorunu hazirlar.
- `npm run dev`: Projeyi yerel sunucuda calistirir.
- `npm test`: Guvenlik odakli testleri calistirir.
- `npm run verify`: Vendor hazirligi ve testleri birlikte calistirir.

## 6. Veri Modeli ve Supabase

Veri katmani Supabase uzerine kuruludur. `supabase_schema.sql` tarihsel ana semayi, `supabase/migrations` klasoru ise guncel migrasyon kaynagini temsil eder. README dosyasinda da belirtildigi gibi yeni ortamlar icin esas kaynak migrasyonlardir; kok dizindeki SQL dosyalari tarihsel referans olarak degerlendirilmelidir.

Projede kullanilan baslica tablolar ve veri alanlari sunlardir:

- `profiles`: Kullanici profilleri, roller, mezuniyet bilgileri, iletisim tercihleri, meslek, universite, sosyal baglantilar.
- `events`: Etkinlik ve duyuru kayitlari.
- `posts`, `post_likes`, `post_comments`: Topluluk paylasimlari, begeniler ve yorumlar.
- `scholarships`, `applications`: Burs programlari ve burs basvurulari.
- `gallery`: Galeri kayitlari.
- `contact_requests`: Mezunlar arasi iletisim talepleri.
- `mentorships`, `mentorship_appointments`: Mentorluk talepleri, eslesmeler ve randevular.
- `job_postings`, `job_applications`, `internship_requests`: Kariyer ve staj surecleri.
- `data_requests`, `user_legal_consents`: Veri talepleri ve yasal onay kayitlari.

Guvenlik migrasyonlari `public_profiles` adli gorunumle herkese acik profil verisini sinirlandirir. E-posta ve telefon gibi hassas alanlar yalnizca kullanicinin paylasim tercihine gore gorunur.

## 7. Guvenlik ve Uyumluluk

Projede guvenlik ve veri gizliligi icin birden fazla katman bulunur:

- Supabase Row Level Security politikalarinin kullanilmasi.
- Admin yetkilerinin RPC fonksiyonlari uzerinden kontrol edilmesi.
- Profil rol/yetki degisikliklerinin dogrudan istemci guncellemelerine kapatilmasi.
- `public_profiles` gorunumu ile hassas iletisim bilgilerinin kontrollu paylasilmasi.
- Depolama tarafinda galeri yuklemeleri icin kullaniciya ait klasor, dosya turu ve 5 MiB dosya boyutu siniri.
- `js/bootstrap.js` icinde erken asama HTML ve URL temizleme yardimcilari.
- `_headers` dosyasinda Content Security Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy ve HSTS basliklari.
- KVKK aydinlatma metni, acik riza, gizlilik politikasi, cerez politikasi, kullanim kosullari, topluluk kurallari ve veri basvuru/silme sayfalari.
- `tests/security.test.mjs` icinde yetki yukseltme, guvenli profil gorunumu, XSS temizleme, CDN kullanimi ve guvenlik basliklari icin otomatik kontroller.

## 8. Tasarim ve Kullanici Deneyimi

Arayuz, dernek kimligini vurgulayan koyu tonlu ve altin vurgulu bir tasarim dili kullanir. Navigasyon tum ana sayfalarda ortaktir. Mobil uyumluluk icin hamburger menu yapisi, kart tabanli listeler, filtreleme alanlari, modallar ve sekmeli paneller kullanilmistir.

Lucide ikonlari, Leaflet tabanli mezun haritasi ve sayfa bazli animasyonlar deneyimi zenginlestirir. Ana islevler giris/kayit modallariyla desteklenir ve kullanicinin rolune gore farkli sayfalara veya aksiyonlara erisim saglanir.

## 9. Kurulum ve Calistirma

Projeyi yerelde calistirmak icin genel akis:

```powershell
npm install
npm run verify
npm run dev
```

Dagitim cikti klasorunu hazirlamak icin:

```powershell
npm run build
```

Supabase tarafi icin:

```powershell
supabase db push
```

Canli ortama gecmeden once migrasyonlarin once staging Supabase projesinde denenmesi onerilir. Supabase service-role anahtari istemci tarafinda kesinlikle kullanilmamalidir.

## 10. Test ve Dogrulama

Projede mevcut otomatik testler ozellikle guvenlik regresyonlarini yakalamaya odaklanir. `npm test` komutu asagidaki alanlari kontrol eder:

- Profil yetki yukseltme korumalari.
- Herkese acik profil verisinin guvenli gorunumden okunmasi.
- Saklanan XSS riski olan alanlarin kacislanmasi.
- Kullanici bilgilerinin erken render asamasinda temizlenmesi.
- Galeri yukleme sinirlamalari.
- Ucuncu parti CDN script/style kullaniminin engellenmesi.
- Uretim guvenlik basliklarinin tanimli olmasi.

Bu test yapisi proje icin iyi bir guvenlik tabani saglar; ilerleyen asamalarda kullanici akislari icin tarayici tabanli end-to-end testler eklenebilir.

## 11. Genel Degerlendirme

ASDFL Mezunlar Dernegi projesi, yalnizca tanitim sitesi degil; dernek, mezun, ogrenci ve mentor iliskilerini yoneten kapsamli bir topluluk platformudur. Statik on yuz mimarisi sayesinde dagitimi basittir; Supabase entegrasyonu sayesinde kimlik dogrulama, veri saklama, yetkilendirme ve dosya yukleme gibi dinamik ihtiyaclari karsilar.

Projenin guclu yanlari moduler sayfa yapisi, Supabase ile hizli gelistirme modeli, rol bazli kullanici deneyimi, guvenlik basliklari, yasal metinlerin dahil edilmesi ve dernek ihtiyaclarina dogrudan karsilik veren zengin islev setidir.

Gelisim icin one cikan alanlar sunlardir:

- Sayfalar arasinda tekrar eden giris/kayit modal kodlarinin ortak bilesene alinmasi.
- Daha genis otomatik test kapsami, ozellikle kayit, basvuru, mentorluk ve admin akislari icin end-to-end testler.
- Veritabani semasinin tek bir migrasyon zinciri uzerinde daha temiz belgelenmesi.
- Admin paneli ve profil duzenleme akislari icin kullanici deneyimi iyilestirmeleri.
- Teknik dokumantasyona ekran goruntuleri ve rol bazli kullanim senaryolari eklenmesi.

Sonuc olarak proje, ASDFL toplulugunun dijital hafizasini ve dayanisma agini tasiyabilecek kapsamli, gelistirilebilir ve guvenlik bilinciyle tasarlanmis bir web platformudur.
