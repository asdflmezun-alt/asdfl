-- Etkinlikler baseline'ı ve katılım (RSVP) sistemi.
-- 1) events tablosunun migrasyon zincirine alınması + yeni kolonlar (end_time,
--    capacity, cover_url) ve RLS (okuma herkese açık, yazma yalnızca admin).
-- 2) event_rsvps: kullanıcıların "Katılıyorum" kaydı; kontenjan sunucuda uygulanır.
-- 3) Admin yeni etkinlik eklediğinde tüm üyelere bildirim.
-- Tekrar çalıştırılabilir (idempotent).

-- ---- events baseline ----
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_date DATE NOT NULL,
  event_time TEXT,
  end_time TEXT,
  location TEXT,
  type TEXT NOT NULL DEFAULT 'bulusma',
  capacity INTEGER,
  cover_url TEXT,
  upcoming BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mevcut kurulumlarda eksik olabilecek kolonlar güvenle eklenir.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_url TEXT;

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Adı bilinmeyen eski (muhtemelen gevşek) politikalar temizlenir; bilinen-iyi
-- set deterministik olarak kurulur.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.events', pol.policyname);
  END LOOP;
END $$;

-- Etkinlikler duyuru niteliğindedir: girişsiz ziyaretçi de görebilir.
CREATE POLICY "Anyone reads events"
  ON public.events FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins update events"
  ON public.events FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete events"
  ON public.events FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- event_rsvps: katılım kayıtları ----
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.event_rsvps(user_id);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Katılımcı avatar duvarı için giriş yapmış kullanıcılar RSVP'leri okuyabilir.
DROP POLICY IF EXISTS "Authenticated users read rsvps" ON public.event_rsvps;
CREATE POLICY "Authenticated users read rsvps"
  ON public.event_rsvps FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users create own rsvp" ON public.event_rsvps;
CREATE POLICY "Users create own rsvp"
  ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own rsvp" ON public.event_rsvps;
CREATE POLICY "Users update own rsvp"
  ON public.event_rsvps FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own rsvp" ON public.event_rsvps;
CREATE POLICY "Users delete own rsvp"
  ON public.event_rsvps FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Kontenjan sunucuda uygulanır: istemci sayaçla aşamaz. Yalnızca 'going'
-- kayıtları kontenjana sayılır.
CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap INTEGER;
  taken INTEGER;
BEGIN
  IF NEW.status <> 'going' THEN
    RETURN NEW;
  END IF;
  SELECT capacity INTO cap FROM public.events WHERE id = NEW.event_id;
  IF cap IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO taken
  FROM public.event_rsvps
  WHERE event_id = NEW.event_id AND status = 'going'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF taken >= cap THEN
    RAISE EXCEPTION 'Event capacity full';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_event_capacity ON public.event_rsvps;
CREATE TRIGGER enforce_event_capacity
  BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();

-- ---- Yeni etkinlikte tüm üyelere bildirim ----
CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE member RECORD;
BEGIN
  FOR member IN SELECT id FROM public.profiles LOOP
    PERFORM public.notify_user(member.id, 'new_event',
      'Yeni etkinlik: ' || NEW.title,
      COALESCE(NULLIF(NEW.location, ''), 'ASDFL') || ' · ' || to_char(NEW.event_date, 'DD.MM.YYYY'),
      'etkinlikler.html#event-' || NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_event ON public.events;
CREATE TRIGGER notify_new_event
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_event();

-- ---- Admin: etkinlik katılımcı listesi (yoklama / CSV) ----
-- profiles.email ve phone kolonları authenticated role'den REVOKE edilmiştir;
-- admin bu bilgilere yalnızca bu SECURITY DEFINER RPC üzerinden erişebilir.
CREATE OR REPLACE FUNCTION public.list_event_attendees(target_event_id UUID)
RETURNS TABLE (name TEXT, grad_year INTEGER, email TEXT, phone TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;
  RETURN QUERY
    SELECT p.name, p.grad_year, p.email, p.phone, r.created_at
    FROM public.event_rsvps r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.event_id = target_event_id AND r.status = 'going'
    ORDER BY r.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_event_attendees(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_event_attendees(UUID) TO authenticated;

-- ---- Etkinlik hatırlatması (ertesi gün gerçekleşecek etkinliklere RSVP verenlere) ----
CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  sent INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT r.user_id, e.title, e.event_date, e.event_time, e.location, e.id AS event_id
    FROM public.event_rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.status = 'going' AND e.event_date = CURRENT_DATE + INTERVAL '1 day'
  LOOP
    PERFORM public.notify_user(rec.user_id, 'event_reminder',
      'Yarın: ' || rec.title,
      COALESCE(NULLIF(rec.location, ''), 'ASDFL') || COALESCE(' · ' || rec.event_time, ''),
      'etkinlikler.html#event-' || rec.event_id);
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$$;

REVOKE ALL ON FUNCTION public.send_event_reminders() FROM PUBLIC;

-- pg_cron varsa günlük 09:00 UTC hatırlatma işi kurulur; yoksa sessizce atlanır.
-- (Fonksiyon her koşulda tanımlıdır; işi elle de zamanlayabilirsiniz.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('asdfl-event-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'asdfl-event-reminders');
    PERFORM cron.schedule('asdfl-event-reminders', '0 9 * * *', 'SELECT public.send_event_reminders();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- cron şeması bu ortamda yoksa yoksay
END $$;
