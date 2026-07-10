# ASDFL Codex çalışma kuralları

Bu depoda `agent.md` ana proje rehberidir. Her değişiklikten önce ilgili bölümlerini oku. Daha yakın bir dizinde başka `AGENTS.md` bulunursa o dosya kendi alt ağacında ek kurallar sağlar.

## Orkestrasyon

Karmaşık, çok alanlı veya kullanıcı tarafından agent tabanlı yürütülmesi istenen görevlerde global `orchestrate-development` skill'ini kullan. Ana agent orkestratördür; kapsamı, mimari kararları, entegrasyonu ve nihai doğrulamayı sahiplenir.

Küçük, tek dosyalı veya sıkı biçimde bağlı görevlerde alt-agent oluşturma. Ayrıştırılabilen işlerde en küçük yararlı rol grubunu seç:

- `scout`: salt okunur kod keşfi ve dosya:satır kanıtı.
- `frontend-worker`: HTML, CSS, istemci JavaScript'i ve kullanıcıya görünen davranışlar.
- `database-worker`: `supabase/migrations`, RLS, RPC, trigger ve ilgili güvenlik testleri.
- `security-reviewer`: kimlik doğrulama, yetkilendirme, güven sınırları ve kullanıcı girdisi yolları; varsayılan olarak salt okunur.
- `verifier`: uygulamadan bağımsız test ve tarayıcı doğrulaması; bulduğu hatayı kendisi düzeltmez.

Bağımsız işler paralel yürütülebilir. Aynı dosyayı iki yazıcı agente verme. Her delegasyonda amaç, izin verilen dosyalar, yasaklanan işlemler, gerekli kontroller ve beklenen rapor açıkça belirtilmelidir.

Çalışma ortamı agent başına model seçimine izin veriyorsa hızlı keşif/doğrulama için ekonomik model; uygulama için güçlü kodlama modeli; orkestrasyon, güvenlik ve mimari kararlar için en güçlü muhakeme modeli seç. Ortam model seçimini sunmuyorsa mevcut modeli rol talimatlarıyla kullan ve belirli bir alt model kullanıldığını iddia etme.

## Proje sınırları

- Kaynak kod Vanilla HTML, CSS ve JavaScript'tir; framework veya Tailwind ekleme.
- `dist/` üretilmiş çıktıdır; kaynak değişikliklerini orada yapma.
- Kullanıcıya görünen bütün metinleri Türkçe yaz.
- Kullanıcı/veritabanı verisini doğru bağlama göre `ASDFL.escapeHTML`, `ASDFL.escapeAttr`, `ASDFL.safeURL` veya `ASDFL.jsString` ile güvenli hale getir.
- Ham `localStorage` erişimi yerine `ASDFL._storage` kullan; erken inline scriptlerde erişimi `try/catch` ile koru.
- Supabase yetkilendirmesini istemci rol kontrollerine bırakma; RLS/RPC ile sunucuda uygula.
- Mevcut migration dosyalarını değiştirme; yeni, idempotent migration ekle.
- İlgisiz kullanıcı değişikliklerini koru. Özellikle `.claude/settings.local.json` kullanıcıya aittir.

## Doğrulama

Kod değişikliklerinden sonra en az `npm run verify` çalıştır. Kullanıcıya görünen davranış değiştiyse ilgili sayfayı masaüstü ve gerektiğinde 375px mobil görünümde kontrol et; konsol hatalarını ve temel etkileşimi doğrula. JavaScript önbellek token'ları ile `sw.js` içindeki `CACHE_VERSION` gereksinimini `agent.md` ve mevcut desenlere göre uygula.
