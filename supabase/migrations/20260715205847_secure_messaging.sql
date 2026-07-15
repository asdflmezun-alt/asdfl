-- Guvenli bire bir mesajlasma altyapisi.
-- Tum yazma islemleri kontrollu RPC'lerden gecer; istemciler tablolara
-- dogrudan INSERT/UPDATE/DELETE yetkisi almaz.

CREATE SCHEMA IF NOT EXISTS asdfl_private;
REVOKE ALL ON SCHEMA asdfl_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'direct' CHECK (kind = 'direct'),
  direct_key TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  evidence_body TEXT NOT NULL CHECK (char_length(evidence_body) BETWEEN 1 AND 2000),
  evidence_sender_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Reviewed', 'Dismissed')),
  moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_creator_created
  ON public.conversations(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
  ON public.conversation_participants(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON public.user_blocks(blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_status
  ON public.message_reports(status, created_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- RLS sorgularinda conversation_participants tablosunun kendi politikasina
-- tekrar girmeden uyelik kontrolu yapar. auth.uid() disaridan parametre olarak
-- alinmadigi icin baska bir kullanici adina sorgulanamaz.
CREATE OR REPLACE FUNCTION asdfl_private.is_conversation_participant(target_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants AS cp
    WHERE cp.conversation_id = target_conversation_id
      AND cp.user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION asdfl_private.is_conversation_participant(UUID) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA asdfl_private TO authenticated;
GRANT EXECUTE ON FUNCTION asdfl_private.is_conversation_participant(UUID) TO authenticated;

DROP POLICY IF EXISTS "Participants read conversations" ON public.conversations;
CREATE POLICY "Participants read conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (asdfl_private.is_conversation_participant(id));

DROP POLICY IF EXISTS "Participants read conversation members" ON public.conversation_participants;
CREATE POLICY "Participants read conversation members"
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (asdfl_private.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Participants read messages" ON public.messages;
CREATE POLICY "Participants read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (asdfl_private.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Users read own blocks" ON public.user_blocks;
CREATE POLICY "Users read own blocks"
  ON public.user_blocks FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "Reporters and admins read message reports" ON public.message_reports;
CREATE POLICY "Reporters and admins read message reports"
  ON public.message_reports FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = reporter_id OR public.is_admin());

REVOKE ALL ON TABLE public.conversations FROM anon, authenticated;
REVOKE ALL ON TABLE public.conversation_participants FROM anon, authenticated;
REVOKE ALL ON TABLE public.messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_blocks FROM anon, authenticated;
REVOKE ALL ON TABLE public.message_reports FROM anon, authenticated;

GRANT SELECT ON TABLE public.conversations TO authenticated;
GRANT SELECT ON TABLE public.conversation_participants TO authenticated;
GRANT SELECT ON TABLE public.messages TO authenticated;
GRANT SELECT ON TABLE public.user_blocks TO authenticated;
GRANT SELECT ON TABLE public.message_reports TO authenticated;

GRANT ALL ON TABLE public.conversations TO service_role;
GRANT ALL ON TABLE public.conversation_participants TO service_role;
GRANT ALL ON TABLE public.messages TO service_role;
GRANT ALL ON TABLE public.user_blocks TO service_role;
GRANT ALL ON TABLE public.message_reports TO service_role;

CREATE OR REPLACE FUNCTION public.start_direct_conversation(target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  pair_key TEXT;
  result_id UUID;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Giriş yapmanız gerekiyor';
  END IF;
  IF target_user_id IS NULL OR target_user_id = caller_id
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Bu kullanıcı ile mesajlaşma başlatılamadı';
  END IF;

  pair_key := LEAST(caller_id::TEXT, target_user_id::TEXT)
    || ':' || GREATEST(caller_id::TEXT, target_user_id::TEXT);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('direct-message-pair'),
    pg_catalog.hashtext(pair_key)
  );

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = caller_id AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = caller_id)
  ) THEN
    -- Kullanici varligi ve engelleme durumu disariya ayri ayri sizdirilmaz.
    RAISE EXCEPTION 'Bu kullanıcı ile mesajlaşma başlatılamadı';
  END IF;

  -- Eszamanli isteklerin limit kontrolunu gecmesini ve ayni cifti iki kez
  -- olusturmasini onlemek icin kullanici bazli transaction lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('start-direct-conversation'),
    pg_catalog.hashtext(caller_id::TEXT)
  );

  SELECT id INTO result_id
  FROM public.conversations
  WHERE direct_key = pair_key;
  IF result_id IS NOT NULL THEN
    RETURN result_id;
  END IF;

  IF (SELECT count(*) FROM public.conversations
      WHERE created_by = caller_id AND created_at > NOW() - INTERVAL '1 hour') >= 5
     OR (SELECT count(*) FROM public.conversations
         WHERE created_by = caller_id AND created_at > NOW() - INTERVAL '1 day') >= 20 THEN
    RAISE EXCEPTION 'Yeni konuşma limitine ulaştınız; daha sonra tekrar deneyin';
  END IF;

  INSERT INTO public.conversations (kind, direct_key, created_by)
  VALUES ('direct', pair_key, caller_id)
  ON CONFLICT (direct_key) DO UPDATE
    SET direct_key = EXCLUDED.direct_key
  RETURNING id INTO result_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (result_id, caller_id), (result_id, target_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_conversation_message(
  target_conversation_id UUID,
  message_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  clean_body TEXT := btrim(message_body);
  other_user_id UUID;
  pair_key TEXT;
  result_id UUID;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Giriş yapmanız gerekiyor';
  END IF;
  IF clean_body IS NULL OR char_length(clean_body) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Mesaj 1 ile 2000 karakter arasında olmalıdır';
  END IF;
  SELECT other_party.user_id
  INTO other_user_id
  FROM public.conversation_participants AS caller_party
  JOIN public.conversation_participants AS other_party
    ON other_party.conversation_id = caller_party.conversation_id
   AND other_party.user_id <> caller_party.user_id
  WHERE caller_party.conversation_id = target_conversation_id
    AND caller_party.user_id = caller_id
  LIMIT 1;
  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Bu konuşmada mesaj gönderilemiyor';
  END IF;

  pair_key := LEAST(caller_id::TEXT, other_user_id::TEXT)
    || ':' || GREATEST(caller_id::TEXT, other_user_id::TEXT);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('direct-message-pair'),
    pg_catalog.hashtext(pair_key)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('send-conversation-message'),
    pg_catalog.hashtext(caller_id::TEXT)
  );
  IF (SELECT count(*) FROM public.messages
      WHERE sender_id = caller_id AND created_at > NOW() - INTERVAL '1 minute') >= 20
     OR (SELECT count(*) FROM public.messages
         WHERE sender_id = caller_id AND created_at > NOW() - INTERVAL '1 hour') >= 200 THEN
    RAISE EXCEPTION 'Mesaj gönderme limitine ulaştınız; daha sonra tekrar deneyin';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = caller_id AND blocked_id = other_user_id)
       OR (blocker_id = other_user_id AND blocked_id = caller_id)
  ) THEN
    RAISE EXCEPTION 'Bu konuşmada mesaj gönderilemiyor';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (target_conversation_id, caller_id, clean_body)
  RETURNING id INTO result_id;

  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = target_conversation_id;

  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(target_conversation_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  read_time TIMESTAMPTZ := NOW();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Giriş yapmanız gerekiyor';
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = GREATEST(COALESCE(last_read_at, '-infinity'::TIMESTAMPTZ), read_time)
  WHERE conversation_id = target_conversation_id AND user_id = caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bu konuşmaya erişim yetkiniz yok';
  END IF;
  RETURN read_time;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_block(target_user_id UUID, should_block BOOLEAN DEFAULT TRUE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  pair_key TEXT;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Giriş yapmanız gerekiyor';
  END IF;
  IF target_user_id IS NULL OR target_user_id = caller_id THEN
    RAISE EXCEPTION 'Geçersiz kullanıcı';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Kullanıcı bulunamadı';
  END IF;

  pair_key := LEAST(caller_id::TEXT, target_user_id::TEXT)
    || ':' || GREATEST(caller_id::TEXT, target_user_id::TEXT);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('direct-message-pair'),
    pg_catalog.hashtext(pair_key)
  );

  IF COALESCE(should_block, TRUE) THEN
    INSERT INTO public.user_blocks (blocker_id, blocked_id)
    VALUES (caller_id, target_user_id)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
    RETURN TRUE;
  END IF;

  DELETE FROM public.user_blocks
  WHERE blocker_id = caller_id AND blocked_id = target_user_id;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_message(target_message_id UUID, report_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
  clean_reason TEXT := btrim(report_reason);
  target_sender_id UUID;
  target_conversation_id UUID;
  target_body TEXT;
  result_id UUID;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Giriş yapmanız gerekiyor';
  END IF;
  IF clean_reason IS NULL OR char_length(clean_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Şikâyet nedeni 1 ile 500 karakter arasında olmalıdır';
  END IF;

  SELECT sender_id, conversation_id, body
  INTO target_sender_id, target_conversation_id, target_body
  FROM public.messages
  WHERE id = target_message_id
  FOR UPDATE;

  IF target_sender_id IS NULL
     OR target_sender_id = caller_id
     OR NOT EXISTS (
       SELECT 1 FROM public.conversation_participants
       WHERE conversation_id = target_conversation_id AND user_id = caller_id
     ) THEN
    RAISE EXCEPTION 'Bu mesajı şikâyet edemezsiniz';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('report-message'),
    pg_catalog.hashtext(caller_id::TEXT)
  );
  SELECT id INTO result_id
  FROM public.message_reports
  WHERE message_id = target_message_id AND reporter_id = caller_id;
  IF result_id IS NOT NULL THEN
    RETURN result_id;
  END IF;

  IF (SELECT count(*) FROM public.message_reports
      WHERE reporter_id = caller_id AND created_at > NOW() - INTERVAL '1 day') >= 10 THEN
    RAISE EXCEPTION 'Günlük şikâyet limitine ulaştınız';
  END IF;

  INSERT INTO public.message_reports (
    message_id, reporter_id, reason, evidence_body, evidence_sender_id
  )
  VALUES (target_message_id, caller_id, clean_reason, target_body, target_sender_id)
  ON CONFLICT (message_id, reporter_id) DO NOTHING
  RETURNING id INTO result_id;

  IF result_id IS NULL THEN
    SELECT id INTO result_id
    FROM public.message_reports
    WHERE message_id = target_message_id AND reporter_id = caller_id;
  END IF;

  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_message_report(target_report_id UUID, new_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := (SELECT auth.uid());
BEGIN
  IF caller_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin yetkisi gerekiyor';
  END IF;
  IF new_status NOT IN ('Reviewed', 'Dismissed') THEN
    RAISE EXCEPTION 'Geçersiz şikâyet durumu';
  END IF;

  UPDATE public.message_reports
  SET status = new_status,
      moderator_id = caller_id,
      reviewed_at = NOW()
  WHERE id = target_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Şikâyet bulunamadı';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.start_direct_conversation(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_conversation_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_block(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_message_report(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.start_direct_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_conversation_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_block(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_message_report(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION asdfl_private.notify_direct_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sender_name TEXT;
  recipient RECORD;
BEGIN
  SELECT name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  FOR recipient IN
    SELECT user_id
    FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LOOP
    PERFORM public.notify_user(
      recipient.user_id,
      'direct_message',
      'Yeni mesaj',
      COALESCE(sender_name, 'Bir kullanıcı') || ' size yeni bir mesaj gönderdi.',
      'mesajlar.html?conversation=' || NEW.conversation_id::TEXT
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION asdfl_private.notify_direct_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_direct_message ON public.messages;
CREATE TRIGGER notify_direct_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION asdfl_private.notify_direct_message();

-- Mesajlar ve katilimci okundu bilgileri istemciye anlik yansiyabilsin.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_participants'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
    END IF;
  END IF;
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  NULL;
END $$;
