# ASDFL Mezunlar Derneği - AI Developer & Agent Guide (`agent.md`)

Bu döküman, projedeki geliştirme standartlarını, veri tabanı şemasını, mimari kararları ve kritik tarayıcı uyumluluk çözümlerini diğer yapay zeka araçlarının (Cursor, Claude, GPT, Windsurf vb.) anlayabileceği şekilde özetler. Kod tabanında değişiklik yapmadan önce lütfen bu dökümanı referans alınız.

---

## 1. Teknoloji Yığını & Mimari Prensipler

1. **Temel Teknolojiler (Vanilla CSS/JS/HTML)**:
   - Uygulama herhangi bir modern JavaScript framework'ü (React, Vue, Next.js vb.) veya TailwindCSS **kullanmamaktadır**.
   - Tamamen **Vanilla HTML5**, **Vanilla JavaScript (ES6+)** ve **Vanilla CSS3** ile oluşturulmuştur. Arayüzün performansı ve kontrolü doğrudan düz kodlama ile sağlanır.
2. **Tasarım Dili (Aesthetics)**:
   - **Renk Paleti**: Derin lacivert (`var(--navy-950)`: `#02070e`), altın sarısı detaylar (`var(--gold-500)`: `#d4af37`), zümrüt yeşili (`var(--teal-500)`), zengin gri tonları.
   - **Glassmorphism**: Arayüz genelinde yarı şeffaf buzlu cam etkisi kullanılır (`background: var(--glass-bg)`, `border: 1px solid var(--glass-border)`, `backdrop-filter: blur(12px)`).
   - **Animasyonlar**: Sayfa geçişlerinde ve etkileşimlerde akıcı CSS geçişleri (`transition: all 0.3s ease`) ve mikro-etkileşimler kullanılır.
3. **İkon Kütüphanesi**:
   - İkonlar için Lucide ikonları (`lucide-cdn`) kullanılır. 
   - Dinamik olarak render edilen HTML içeriklerinden sonra ikonların görünmesi için **mutlaka** `setTimeout(() => lucide.createIcons(), 10)` çağrısı yapılmalıdır.
4. **Dil**:
   - Tüm kullanıcı arayüzü, hata mesajları, toast bildirimleri ve etiketler **Türkçe** olmalıdır.

---

## 2. Supabase Veritabanı Şeması (Schema)

Platformun veri tabanı Supabase (PostgreSQL) üzerinde koşmaktadır. Ayrıntılı tablolar ve ilişkiler şöyledir:

### `profiles` (Kullanıcı Profilleri)
Tüm kullanıcı türlerinin (Mezun, Öğrenci, Öğretmen, Admin) temel bilgilerini tutar.
- `id` (UUID, Primary Key, auth.users referansı)
- `role` (TEXT, 'Mezun', 'Öğrenci', 'Öğretmen', 'Kullanıcı', 'Admin' değerlerini alabilir)
- `name` (TEXT, Ad Soyad)
- `email` (TEXT, Benzersiz E-posta)
- `grad_year` (INTEGER, Mezuniyet Yılı - Mezunlar için)
- `class_section` (TEXT, Mezuniyet Şubesi - Mezun/Öğrenci için, örn: "A")
- `job` (TEXT, Meslek - Mezunlar için)
- `company` (TEXT, Çalışılan Şirket - Mezunlar için)
- `city` (TEXT, Yaşanılan Şehir)
- `mentor` (BOOLEAN, Mentörlük Durumu - Mezunlar için)
- `grade` (TEXT, Sınıf - Öğrenciler için, örn: "9. Sınıf")
- `branch` (TEXT, Branş - Öğretmenler için)
- `teaching_year` (INTEGER, Göreve Başlangıç Yılı - Öğretmenler için)
- `bio` (TEXT, Hakkımda Kısa Bilgi)
- `avatar_url` (TEXT, Base64 formatında profil fotoğrafı)
- `avatar_position` (TEXT, Fotoğraf yakınlaştırma ve hizalama ayarı, formatı: `scale,panX,panY`, örn: `1.20,5%,-10%`)
- `phone` (TEXT, İletişim Telefonu)
- `share_phone` (BOOLEAN, Telefonu herkese açık paylaşma seçeneği)
- `share_email` (BOOLEAN, E-postayı herkese açık paylaşma seçeneği)
- `linkedin_url`, `github_url`, `instagram_url` (TEXT, Sosyal medya bağlantıları)

### `contact_requests` (İletişim Erişim Talepleri)
Mezunların gizli iletişim bilgilerine (e-posta/telefon) erişmek için gönderilen talepleri saklar.
- `id` (UUID, Primary Key)
- `sender_id` (UUID, Gönderen kullanıcı `profiles.id`)
- `receiver_id` (UUID, Alıcı kullanıcı `profiles.id`)
- `status` (TEXT, 'Pending', 'Approved', 'Rejected')

### `mentorships` (Mentör-Öğrenci İlişkileri)
- `id` (UUID, Primary Key)
- `mentor_id`, `student_id` (UUID)
- `status` (TEXT, 'Pending', 'Active', 'Completed', 'Cancelled')
- `notes` (TEXT, İlişki başlangıç notu)

### `mentorship_appointments` (Mentörlük Randevuları)
- `id` (UUID, Primary Key)
- `mentor_id`, `student_id` (UUID)
- `appointment_date` (DATE)
- `appointment_time` (TEXT, Saat, örn: "18:00")
- `duration` (INTEGER, Randevu süresi dakika bazında, varsayılan: 45)
- `status` (TEXT, 'Scheduled', 'Completed', 'Cancelled')

### `job_postings` (Kariyer Ağı İş & Staj İlanları)
- `employer_id` (UUID, İlanı veren mezun/admin)
- `title` (TEXT, İlan Başlığı)
- `type` (TEXT, 'İş' veya 'Staj')
- `company` (TEXT, Şirket adı)
- `location` (TEXT, Konum)
- `description` (TEXT, İlan detayları)
- `status` (TEXT, 'Active', 'Closed')

### `job_applications` (İlan Başvuruları)
- `posting_id` (UUID), `applicant_id` (UUID)
- `resume_url` (TEXT, Base64 veya dosya bağlantısı)
- `cover_letter` (TEXT, Ön yazı notu)
- `status` (TEXT, 'Pending', 'Approved', 'Rejected')

### `internship_requests` (Öğrencilerin Staj Talepleri)
- `student_id` (UUID), `title` (TEXT), `field` (TEXT, Alan), `details` (TEXT)
- `status` (TEXT, 'Pending', 'Active', 'Closed')

### Diğer Tablolar
- `posts` & `post_likes` & `post_comments`: Topluluk panosu gönderileri, beğenileri ve yorumları.
- `events`: Mezuniyet buluşmaları ve etkinlikler.
- `gallery`: Okul ve dernek etkinliklerine ait fotoğraf galerisi.
- `scholarships` & `applications`: Burs verenlerin ilanları ve burs başvuruları.

---

## 3. Kritik Tarayıcı Uyumluluk Çözümleri (MANDATORY SAFEGUARDS)

Aşağıdaki kurallar, özellikle mobil cihazlarda, Safari Gizli Sekmelerde (Private Tabs) veya çerez kısıtlamalı tarayıcılarda sitenin çökmesini önlemek için geliştirilmiş **kesin kurallardır**:

### Rule 1: Doğrudan `localStorage` Kullanmayın!
Safari Gizli Sekme modunda veya yerel depolama engellendiğinde, `localStorage.getItem` veya `localStorage.setItem` çağrıları doğrudan **`SecurityError: The operation is insecure`** istisnası fırlatır. Bu hata JavaScript motorunu durdurur ve arayüz butonlarını (giriş yap dahil) tamamen kilitler.

* **Yanlış Kullarım (DO NOT DO)**:
  ```javascript
  localStorage.setItem('asdfl_user', JSON.stringify(user));
  let data = localStorage.getItem('asdfl_alumni');
  ```
* **Doğru Kullanım (ALWAYS USE THE WRAPPER)**:
  `js/app.js` içerisinde hata fırlatmayan, sırasıyla `localStorage` -> `sessionStorage` -> bellek (memory fallback) adımlarını izleyen özel bir depolama sarmalayıcısı (`ASDFL._storage`) tanımlanmıştır. Her zaman bunu kullanın:
  ```javascript
  ASDFL._storage.setItem('asdfl_user', JSON.stringify(user));
  let data = ASDFL._storage.getItem('asdfl_alumni');
  ```
  *(Supabase istemcisi kurulurken de bu sarmalayıcı `auth.storage` parametresi olarak atanmıştır, bu sayede Supabase kimlik doğrulama işlemleri de engelli ortamlarda çökmez).*

### Rule 2: Inline Sayfa Başı Scriptlerini `try-catch` Bloğuna Alın!
HTML dosyalarının (`index.html`, `mezunlar.html` vb.) en başında navbar durumunu anlık kontrol eden inline scriptler bulunmaktadır. Bu kısımlar `ASDFL` nesnesi henüz yüklenmeden çalıştığı için ham `localStorage` erişimi içerirler. Bu erişimlerin çökerek sayfa parser'ını durdurmasını önlemek için **kesinlikle** `try-catch` bloğunda yazılmaları gerekir:
```javascript
let userStr = null;
try {
  userStr = localStorage.getItem('asdfl_user') || sessionStorage.getItem('asdfl_user');
} catch(e) {
  // Hata sessizce yutulur, çökme önlenir
}
```

### Rule 3: Profil Fotoğrafı Hizalama Formatı
Profil fotoğrafının dairesel çerçevede tam konumlandırılabilmesi için `avatar_position` alanı `scale,panX,panY` biçiminde kaydedilir.
* Örnek: `1.20,-5%,10%`
* JS ile img transformu yapılırken bu değerler çözümlenir: `transform: scale(scale) translate(panX, panY); transform-origin: center center;`
* Profil fotoğrafı yükleme ve düzenleme yaparken bu format yapısını bozmamaya dikkat edin.

---

## 4. Mobil Responsive Arayüz Kuralları (CSS & Layout)

1. **Yatay Taşmaları Engelleme**:
   - Mobil görünümde sayfanın sağa-sola kaymasını (`horizontal scroll`) önlemek için `html` ve `body` etiketlerine `overflow-x: hidden;` uygulanmıştır. 
   - Mobil menü kapalıyken tıklama algılamaması ve ekran sınırlarını taşırmaması için mobil `.nav-links` sınıfına `visibility: hidden;` verilir, menü açıldığında `visibility: visible;` konumuna getirilir.
2. **Yönetim Paneli Menüsü**:
   - Dikey sekmeler mobil çözünürlüklerde (`max-width: 991px`) yatayda kaydırılabilir hap butonları (`.admin-nav` içindeki `.admin-nav-item`) şeklindedir. Kesinlikle dikey olarak alt alta kırılmamalıdır.
3. **Buton Dokunma Alanı (Touch Target)**:
   - Mobilde tıklanacak tüm butonların ve bağlantıların en az `44px x 44px` boyutlarında veya yeterli padding'e sahip olmasına özen gösterin.
