# Android yayın rehberi

Bu depo, mevcut `https://www.asdflmezun.org` PWA'sını Trusted Web Activity (TWA) olarak paketler. GitHub Actions elle başlatıldığında imzalı APK ve Google Play için AAB üretir; otomatik olarak mağazaya yükleme yapmaz. Apex alan adı `www` adresine yönlendiği için TWA'nın doğrulanan hostu doğrudan `www.asdflmezun.org` olarak ayarlanmıştır.

> **Kalıcı karar:** Varsayılan Android paket kimliği `org.asdflmezun.app` değeridir. İlk Google Play yüklemesinden önce değiştirmek isterseniz `android/twa-manifest.template.json` ve `android/assetlinks.json.template` dosyalarını birlikte güncelleyin. İlk yüklemeden sonra paket kimliği değiştirilemez.

## 1. Upload anahtarını oluşturun

Anahtarı repo klasörünün dışında ve yedekli, güvenli bir konumda oluşturun. JDK içindeki `keytool` ile örnek komut:

```powershell
keytool -genkeypair -v -keystore asdfl-upload.jks -alias asdfl-upload -keyalg RSA -keysize 2048 -validity 10000
```

Bu dosyayı ve parolaları kaybederseniz yeni sürüm yüklemek zorlaşır. Keystore'u Git'e eklemeyin.

## 2. GitHub environment ve secret'ları ekleyin

GitHub'da **Settings → Environments → New environment** yolundan `android-release` adında bir environment oluşturun. Yalnız korumalı `main` dalına izin verin ve mümkünse bir onaylayıcı tanımlayın.

Keystore'u Base64 metnine dönüştürmek için PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\guvenli\konum\asdfl-upload.jks")) | Set-Clipboard
```

`android-release` environment içine şu secret'ları ekleyin:

- `ANDROID_KEYSTORE_BASE64`: panoya alınan Base64 metni
- `ANDROID_KEYSTORE_PASSWORD`: keystore parolası
- `ANDROID_KEY_ALIAS`: örnekteki `asdfl-upload`
- `ANDROID_KEY_PASSWORD`: anahtar parolası

## 3. Paketi GitHub üzerinden üretin

1. Değişiklikleri `main` dalına alın.
2. **Actions → Android paketi → Run workflow** ekranını açın.
3. Kullanıcıya gösterilecek `version_name` değerini girin; örneğin `1.0.0`.
4. Daha önce kullanılmamış, her yayında artan `version_code` değerini girin; örneğin `1`.
5. İş tamamlandığında `asdfl-android-...` artifact'ini indirin.

Artifact içinde test kurulumu için imzalı APK, Google Play'e yüklenecek AAB ve iki dosyanın SHA-256 sağlama toplamı bulunur.

## 4. Digital Asset Links dosyasını yayınlayın

Google Play Console'da uygulamayı oluşturup ilk AAB'yi yükledikten sonra **App integrity / Uygulama bütünlüğü** bölümündeki **App signing key certificate SHA-256** değerini alın. Bu, GitHub'daki upload anahtarının parmak izi değildir.

1. `android/assetlinks.json.template` dosyasını `.well-known/assetlinks.json` olarak kopyalayın.
2. `PLAY_APP_SIGNING_SHA256_FINGERPRINT` metnini Play Console'daki SHA-256 değeriyle değiştirin.
3. Dosyayı siteyle birlikte yayınlayın.
4. `https://www.asdflmezun.org/.well-known/assetlinks.json` adresinin yönlendirme olmadan `200` yanıtı ve `application/json` içerik türü verdiğini doğrulayın.

Play dışından doğrudan APK da dağıtılacaksa APK'yı imzalayan upload sertifikasının SHA-256 parmak izini aynı dizide ikinci değer olarak ekleyebilirsiniz. Debug sertifikasını üretim dosyasına eklemeyin.

Digital Asset Links yayınlanana kadar uygulama çalışır; ancak doğrulanmış TWA yerine tarayıcı arayüzü gösterebilir.
