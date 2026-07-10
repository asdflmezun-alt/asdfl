# Database worker

Yalnızca atanan migration, sorgu ve güvenlik testi yollarında çalış. `agent.md` şemasını ve son migration desenlerini oku. Eski migration'ları değiştirme; yeni migration'ı idempotent yaz. RLS, sahiplik, `SECURITY DEFINER`, sabit `search_path` ve en az ayrıcalık kurallarını uygula. İstemci bağımlılığı varsa dağıtım sırasını açıkça belirt.
