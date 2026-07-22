(function () {
  const VERSION = '2026-06-18';
  const SITE_URL = 'https://www.asdflmezun.org';
  const SITE_LABEL = 'www.asdflmezun.org';
  const CONTACT_EMAIL = 'info@asdfl.org';
  const documents = {
    'kvkk-aydinlatma': {
      title: 'KVKK Aydınlatma Metni',
      sections: [
        ['Veri Sorumlusu', `<p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu Afyon Süleyman Demirel Fen Lisesi Mezunlar Derneğidir ("Dernek"). Derneğin çevrim içi platformu <a href="${SITE_URL}/">${SITE_LABEL}</a> adresinde sunulmakta olup veri koruma ve iletişim talepleri <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresine iletilebilir.</p>`],
        ['İşlenen Kişisel Veriler', '<ul><li>Kimlik ve iletişim bilgileri</li><li>Mezuniyet, eğitim, meslek ve profil bilgileri</li><li>Profil fotoğrafı ve sosyal medya bağlantıları</li><li>Üyelik tercihleri, başvurular ve platform kullanım kayıtları</li><li>Oturum ve bilgi güvenliği amacıyla işlenen teknik kayıtlar</li></ul>'],
        ['İşleme Amaçları', '<ul><li>Üyelik ve kimlik doğrulama süreçlerini yürütmek</li><li>Mezunlar arasındaki iletişim ve dayanışmayı sağlamak</li><li>Etkinlik, burs, mentorluk ve duyuru hizmetlerini sunmak</li><li>Bilgi güvenliğini sağlamak ve yasal yükümlülükleri yerine getirmek</li><li>Platformu geliştirmek ve istatistiksel değerlendirmeler yapmak</li></ul>'],
        ['Hukuki Sebepler ve Toplama Yöntemi', '<p>Veriler; üyelik ve profil formları, elektronik iletişim kanalları ve platform kullanımı üzerinden elektronik ortamda toplanır. İşleme faaliyetleri KVKK m.5 kapsamındaki sözleşmenin kurulması veya ifası, hukuki yükümlülük, bir hakkın tesisi veya korunması, meşru menfaat ve gerektiğinde açık rıza sebeplerine dayanır.</p>'],
        ['Verilerin Aktarılması', '<p>Veriler; yetkili kamu kurumlarına, hukuken yetkili mercilere ve barındırma, kimlik doğrulama, e-posta veya teknik altyapı sağlayıcılarına amaçla sınırlı ve gerekli güvenlik tedbirleri alınarak aktarılabilir. Ticari amaçlı paylaşım ayrıca izin alınmadan yapılmaz.</p>'],
        ['Haklarınız', `<p>KVKK m.11 kapsamında verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanımı öğrenme, aktarılan kişileri öğrenme, düzeltme, silme veya yok etme isteme, otomatik analiz sonuçlarına itiraz etme ve zararın giderilmesini isteme haklarına sahipsiniz. Bu haklara ilişkin başvurularınızı <a href="veri-basvuru-silme.html">Veri Başvurusu</a> sayfasından veya <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresinden iletebilirsiniz.</p>`]
      ]
    },
    'acik-riza': {
      title: 'Açık Rıza Metni',
      notice: 'Açık rıza yalnızca zorunlu olmayan veri işleme faaliyetleri içindir ve üyeliğin kurulması için şart değildir.',
      sections: [
        ['Rızanın Kapsamı', '<p>Profilimde paylaşmayı seçtiğim telefon ve e-posta bilgilerinin, mezunlar ağı içerisinde diğer doğrulanmış üyeler tarafından görülebilmesine özgür irademle izin verebilirim.</p>'],
        ['Tercihlerin Yönetimi', '<p>Telefon ve e-posta paylaşım tercihleri ayrı ayrı verilir. Kutular önceden seçili değildir ve bu izinler verilmeden üyelik oluşturulabilir.</p>'],
        ['Rızanın Geri Çekilmesi', `<p>Rızamı profil ayarlarından, <a href="veri-basvuru-silme.html">veri başvurusu</a> oluşturarak veya <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresine yazarak dilediğim zaman ileriye etkili şekilde geri çekebilirim. Geri çekme öncesinde rızaya dayalı gerçekleştirilen işlemler bundan etkilenmez.</p>`]
      ]
    },
    'gizlilik-politikasi': {
      title: 'Gizlilik Politikası',
      sections: [
        ['Kapsam', `<p>Bu politika, <a href="${SITE_URL}/">${SITE_LABEL}</a> adresindeki ASDFL Mezunlar Derneği platformunun ziyaretçi ve üyelerine ait bilgileri nasıl topladığını, kullandığını, koruduğunu ve hangi tercihlerle yönetilebildiğini açıklar.</p>`],
        ['Toplanan Bilgiler', '<p>Üyelik sırasında verilen bilgiler, profil tercihleri, başvurular, paylaşımlar ve oturum güvenliği için gerekli teknik kayıtlar işlenebilir. Platform ödeme verisi toplamaz.</p>'],
        ['Hizmet Sağlayıcılar', '<p>Kimlik doğrulama ve veri saklama için Supabase; arayüz bileşenleri ve harita sunumu için jsDelivr, unpkg ve Leaflet kaynakları kullanılmaktadır. Bu sağlayıcılara yalnızca hizmetin sunulması için gerekli teknik bilgiler iletilebilir.</p>'],
        ['Güvenlik ve Saklama', '<p>Yetkilendirme, satır seviyesinde erişim kuralları ve erişim kontrolleri uygulanır. Veriler yalnızca işleme amacı ve hukuki yükümlülükler için gerekli süre boyunca saklanır; süre sonunda silinir, yok edilir veya anonimleştirilir.</p>'],
        ['Tercihleriniz', `<p>Profil paylaşım tercihlerinizi değiştirebilir, açık rızanızı geri çekebilir ve bilgi, düzeltme, kopya veya silme talebinizi profilinizden ya da <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresinden iletebilirsiniz.</p>`]
      ]
    },
    'cerez-politikasi': {
      title: 'Çerez ve Yerel Depolama Politikası',
      sections: [
        ['Kullanılan Teknolojiler', `<p><a href="${SITE_URL}/">${SITE_LABEL}</a> adresindeki platform, oturumun korunması ve kullanıcı deneyiminin sürdürülebilmesi için Supabase oturum anahtarları ile tarayıcının localStorage veya sessionStorage alanını kullanır.</p>`],
        ['Zorunlu Depolama', '<p>Kimlik doğrulama, güvenlik, oturum yenileme, kullanıcı tercihleri ve çevrimdışı hata toleransı için kullanılan kayıtlar hizmetin çalışması açısından zorunludur.</p>'],
        ['Üçüncü Taraf Kaynaklar', '<p>Supabase, jsDelivr, unpkg ve Leaflet üzerinden yüklenen teknik kaynaklar bağlantı bilgileri gibi sınırlı teknik verileri işleyebilir. Güncel ayrıntılar ilgili sağlayıcıların politikalarında yer alır.</p>'],
        ['Analitik ve Reklam', '<p>Platformda şu anda zorunlu olmayan analitik, davranışsal reklam veya çapraz site takip aracı kullanılmamaktadır. Böyle bir araç eklenirse etkinleştirilmeden önce ayrı tercih alınacaktır.</p>'],
        ['Tarayıcı Ayarları', '<p>Tarayıcı ayarlarından depolama kayıtlarını silebilirsiniz. Zorunlu kayıtların engellenmesi oturum açma ve platform özelliklerinin çalışmasını etkileyebilir.</p>']
      ]
    },
    'kullanim-kosullari': {
      title: 'Kullanım Koşulları',
      sections: [
        ['Amaç ve Üyelik', `<p><a href="${SITE_URL}/">${SITE_LABEL}</a> adresindeki platform mezunları, öğrencileri ve okul topluluğunu bir araya getirmek için sunulur. Kullanıcılar doğru ve güncel bilgi vermeyi, hesap güvenliğini korumayı ve başka kişilerin hesabını kullanmamayı kabul eder.</p>`],
        ['Kullanıcı Sorumluluğu', '<ul><li>Mevzuata ve üçüncü kişi haklarına uygun davranmak</li><li>Hakaret, tehdit, taciz, ayrımcılık ve nefret söyleminden kaçınmak</li><li>Spam, yanıltıcı reklam ve yetkisiz veri toplama yapmamak</li><li>Platform güvenliğini tehlikeye düşürmemek</li></ul>'],
        ['İçerik ve Fikri Haklar', '<p>Site tasarımı, yazılımı, logosu ve kurumsal içerikleri ilgili hak sahiplerine aittir. Kullanıcı içeriklerinin hukuka uygunluğundan içeriği paylaşan kullanıcı sorumludur.</p>'],
        ['Moderasyon ve Üyeliğin Sona Ermesi', '<p>Kurallara aykırı içerikler kaldırılabilir; hesaplar uyarılabilir, sınırlandırılabilir, askıya alınabilir veya sonlandırılabilir.</p>'],
        ['Hizmet ve Sorumluluk', '<p>Bakım, güvenlik veya mücbir sebeplerle kesintiler yaşanabilir. Üçüncü taraf bağlantılarının içerik ve güvenlik uygulamalarından Dernek sorumlu değildir.</p>'],
        ['Uygulanacak Hukuk', '<p>Türkiye Cumhuriyeti hukuku uygulanır. Uyuşmazlıklarda Afyonkarahisar Mahkemeleri ve İcra Daireleri yetkilidir.</p>']
      ]
    },
    'topluluk-kurallari': {
      title: 'Üyelik ve Topluluk Kuralları',
      sections: [
        ['Saygı ve Nezaket', '<p>Üyeler farklı görüşlere karşı yapıcı bir dil kullanır; hakaret, tehdit, taciz, ayrımcılık ve nefret söylemine yer vermez.</p>'],
        ['Gerçek Kimlik ve Doğru Bilgi', '<p>Sahte hesap, başkasına ait hesap veya yanıltıcı bilgi kullanılamaz. Dernek gerektiğinde mezuniyet ve üyelik bilgilerini doğrulayabilir.</p>'],
        ['Dayanışma', '<p>Platform; kariyer, eğitim, mentorluk, sosyal sorumluluk, etkinlik ve akademik dayanışmayı desteklemek amacıyla kullanılır.</p>'],
        ['İçerik ve Gizlilik', '<p>Paylaşımlar hukuka uygun olmalı; başkalarının kişisel verileri izinsiz paylaşılmamalı, ticari amaçla kullanılmamalı ve istenmeyen toplu ileti gönderilmemelidir.</p>'],
        ['Kural İhlalleri', '<p>İhlallerde uyarı, içerik kaldırma, geçici erişim kısıtlaması, üyeliği askıya alma veya kalıcı sonlandırma uygulanabilir.</p>'],
        ['Ortak Değerler', '<p>Saygı, dayanışma, bilimsel düşünce, etik değerler, gönüllülük ve kurumsal aidiyet topluluğun ortak değerleridir.</p>']
      ]
    },
    'veri-basvuru-silme': {
      title: 'Kişisel Veri Başvuru, Düzeltme ve Silme Politikası',
      sections: [
        ['Başvuru Konuları', '<p>Kullanıcılar bilgi, veri kopyası, düzeltme, açık rızayı geri çekme ve hesap ile kişisel verilerin silinmesi taleplerini iletebilir.</p>'],
        ['Başvuru Yöntemi', `<p>Giriş yapan kullanıcılar profil sayfasındaki “Gizlilik ve Verilerim” bölümünden başvuru oluşturabilir. Başvurular ayrıca <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresine e-posta gönderilerek iletilebilir. Kimlik doğrulaması için ek bilgi istenebilir.</p>`],
        ['Değerlendirme', '<p>Başvurular talebin niteliğine göre en kısa sürede ve mevzuatta öngörülen süre içerisinde değerlendirilir. Sonuç kullanıcıya uygun bir iletişim kanalıyla bildirilir.</p>'],
        ['Düzeltme ve Silme', '<p>Yanlış veya eksik veriler düzeltilebilir. Saklanması hukuken zorunlu olmayan veriler talep üzerine silinir, yok edilir veya anonimleştirilir.</p>'],
        ['Saklama İstisnaları', '<p>Hukuki yükümlülükler veya bir hakkın tesisi, kullanılması ya da korunması için gerekli kayıtlar ilgili saklama süresi boyunca erişimi kısıtlanarak tutulabilir.</p>'],
        ['Veri Güvenliği', '<p>Yetkisiz erişimi, kaybı ve hukuka aykırı işlemeyi önlemek amacıyla uygun teknik ve idari tedbirler uygulanır.</p>']
      ]
    }
  };
  const links = [
    ['kvkk-aydinlatma.html', 'KVKK'], ['acik-riza.html', 'Açık Rıza'],
    ['gizlilik-politikasi.html', 'Gizlilik'], ['cerez-politikasi.html', 'Çerezler'],
    ['kullanim-kosullari.html', 'Kullanım Koşulları'], ['topluluk-kurallari.html', 'Topluluk Kuralları'],
    ['veri-basvuru-silme.html', 'Veri Başvurusu']
  ];
  const key = document.body.dataset.legalDocument;
  const doc = documents[key];
  if (!doc) return;
  document.title = `${doc.title} | ASDFL Mezunlar Derneği`;
  document.getElementById('legalTitle').textContent = doc.title;
  document.getElementById('legalMeta').textContent = `Sürüm ${VERSION} · Son güncelleme: 18 Temmuz 2026`;
  document.getElementById('legalNav').innerHTML = links.map(([href, label]) => `<a href="${href}"${href === key + '.html' ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  document.getElementById('legalContent').innerHTML = `${doc.notice ? `<div class="legal-notice">${doc.notice}</div>` : ''}${doc.sections.map(([heading, html], index) => `<section id="section-${index + 1}"><h2>${index + 1}. ${heading}</h2>${html}</section>`).join('')}<div class="legal-contact"><h2>İletişim</h2><p><strong>Afyon Süleyman Demirel Fen Lisesi Mezunlar Derneği</strong><br><a href="${SITE_URL}/">${SITE_LABEL}</a><br><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p><p><small>Derneğin resmî tebligat adresi yayından önce eklenecektir.</small></p></div>`;
  document.getElementById('legalFooterLinks').innerHTML = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
})();
