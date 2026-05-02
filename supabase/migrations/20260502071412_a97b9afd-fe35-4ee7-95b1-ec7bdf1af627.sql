
CREATE TABLE IF NOT EXISTS public.company_mpesa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  environment text NOT NULL DEFAULT 'sandbox',
  business_shortcode text,
  party_b text,
  consumer_key text,
  consumer_secret text,
  passkey text,
  callback_url text,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_mpesa_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/write directly. Company admins go through edge function.
CREATE POLICY "mpesa_super_all"
  ON public.company_mpesa_settings
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER tg_company_mpesa_settings_updated
BEFORE UPDATE ON public.company_mpesa_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper for company admins to know if M-Pesa is configured (no secrets exposed)
CREATE OR REPLACE FUNCTION public.get_company_mpesa_status(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.company_mpesa_settings;
BEGIN
  IF NOT (public.has_company_role(auth.uid(), 'company_admin', _company_id)
          OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _row FROM public.company_mpesa_settings WHERE company_id = _company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'configured', false,
      'is_enabled', false,
      'environment', 'sandbox'
    );
  END IF;

  RETURN jsonb_build_object(
    'configured', true,
    'is_enabled', _row.is_enabled,
    'environment', _row.environment,
    'business_shortcode', _row.business_shortcode,
    'party_b', _row.party_b,
    'callback_url', _row.callback_url,
    'has_consumer_key', (_row.consumer_key IS NOT NULL AND length(_row.consumer_key) > 0),
    'has_consumer_secret', (_row.consumer_secret IS NOT NULL AND length(_row.consumer_secret) > 0),
    'has_passkey', (_row.passkey IS NOT NULL AND length(_row.passkey) > 0),
    'updated_at', _row.updated_at
  );
END $$;
