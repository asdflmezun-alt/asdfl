-- 6. İletişim Erişim Talepleri Detay Alanlarının Eklenmesi
-- Bu SQL betiği, contact_requests tablosuna mesaj ve neden (reason) alanlarını ekler.

ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS message TEXT;

-- RLS politikaları zaten mevcut olduğu için yeni politika gerekmemektedir.
-- Tabloya eklenen yeni sütunlar mevcut SELECT, INSERT, UPDATE politikaları ile uyumludur.
