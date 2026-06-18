-- ASDFL legal consent and personal-data request infrastructure.
-- Safe to run repeatedly in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.user_legal_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('kvkk_notice', 'terms_and_community', 'optional_contact_sharing')),
  document_version TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'registration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, document_type, document_version)
);

CREATE TABLE IF NOT EXISTS public.data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('information', 'correction', 'data_copy', 'withdraw_consent', 'account_deletion')),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'InProgress', 'Resolved', 'Rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_legal_consents_user ON public.user_legal_consents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_requests_user ON public.data_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON public.data_requests(status, created_at DESC);

ALTER TABLE public.user_legal_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own legal consents" ON public.user_legal_consents;
CREATE POLICY "Users read own legal consents" ON public.user_legal_consents
  FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
  );

DROP POLICY IF EXISTS "Users insert own legal consents" ON public.user_legal_consents;
CREATE POLICY "Users insert own legal consents" ON public.user_legal_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own data requests" ON public.data_requests;
CREATE POLICY "Users read own data requests" ON public.data_requests
  FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
  );

DROP POLICY IF EXISTS "Users create own data requests" ON public.data_requests;
CREATE POLICY "Users create own data requests" ON public.data_requests
  FOR INSERT WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id AND status = 'Pending' AND admin_note = '' AND resolved_at IS NULL);

DROP POLICY IF EXISTS "Admins update data requests" ON public.data_requests;
CREATE POLICY "Admins update data requests" ON public.data_requests
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Admin'));

-- Consent history is append-only. Withdrawal is the only allowed mutation.
CREATE OR REPLACE FUNCTION public.withdraw_legal_consent(target_consent_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_legal_consents
  SET withdrawn_at = COALESCE(withdrawn_at, NOW())
  WHERE id = target_consent_id
    AND user_id = auth.uid()
    AND document_type = 'optional_contact_sharing'
    AND accepted = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent record cannot be withdrawn';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_legal_consent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_legal_consent(UUID) TO authenticated;

-- Records registration choices even when email confirmation means no client session exists yet.
CREATE OR REPLACE FUNCTION public.capture_registration_legal_consents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  version TEXT := COALESCE(NEW.raw_user_meta_data->>'legalDocumentVersion', '2026-06-18');
BEGIN
  IF COALESCE((NEW.raw_user_meta_data->>'kvkkNoticeAccepted')::BOOLEAN, false) THEN
    INSERT INTO public.user_legal_consents(user_id, document_type, document_version, accepted, source)
    VALUES (NEW.id, 'kvkk_notice', version, true, 'registration') ON CONFLICT DO NOTHING;
  END IF;
  IF COALESCE((NEW.raw_user_meta_data->>'termsAccepted')::BOOLEAN, false) THEN
    INSERT INTO public.user_legal_consents(user_id, document_type, document_version, accepted, source)
    VALUES (NEW.id, 'terms_and_community', version, true, 'registration') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_legal_consents(user_id, document_type, document_version, accepted, source)
  VALUES (NEW.id, 'optional_contact_sharing', version, COALESCE((NEW.raw_user_meta_data->>'optionalConsent')::BOOLEAN, false), 'registration')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_capture_legal_consents ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_zz_legal_consents ON auth.users;
-- PostgreSQL runs same-event triggers alphabetically; this must follow on_auth_user_created.
CREATE TRIGGER on_auth_user_zz_legal_consents
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.capture_registration_legal_consents();
