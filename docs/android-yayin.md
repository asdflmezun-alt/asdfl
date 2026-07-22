# Android test APK rehberi

Bu akış yalnızca siteyi Android telefonda denemek içindir. Google Play Console, kalıcı keystore, GitHub environment veya secret hazırlamanız gerekmez.

GitHub Actions her çalıştırmada geçici bir test anahtarı üretir, `https://www.asdflmezun.org` sitesini Trusted Web Activity olarak paketler ve telefona kurulabilir bir APK verir. Artifact'e AAB eklenmez ve Play Store'a herhangi bir yükleme yapılmaz.

## APK'yı üretin

1. Workflow dosyasını varsayılan dala alın.
2. GitHub'da **Actions → Android test APK → Run workflow** ekranını açın.
3. İş tamamlandığında `asdfl-test-apk-...` artifact'ini indirin.
4. ZIP içindeki `app-release-signed.apk` dosyasını Android telefona gönderin ve kurun.

Telefon, Play Store dışından kurulum için tarayıcıya veya dosya yöneticisine “bilinmeyen uygulama yükleme” izni vermenizi isteyebilir.

## Test sürümünün sınırları

- Her çalıştırmada yeni bir test imzası oluşur. Önceki APK yüklüyse yeni APK güncelleme olarak kurulamayabilir; eski ASDFL test uygulamasını kaldırıp yeniden kurun.
- Digital Asset Links yayınlanmadığı için bazı cihazlarda uygulama üst kısmında tarayıcı araç çubuğu görünebilir. Site işlevlerini test etmeye engel değildir.
- Bu APK'yı Google Play'e yüklemeyin. Mağaza yayınına geçildiğinde kalıcı ve güvenli bir upload anahtarıyla ayrı yayın akışı hazırlanmalıdır.

Varsayılan Android paket kimliği `org.asdflmezun.app` değeridir.
