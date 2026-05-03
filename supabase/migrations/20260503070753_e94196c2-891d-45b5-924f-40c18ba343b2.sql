
-- 1. Force production-only M-Pesa
UPDATE public.company_mpesa_settings SET environment = 'production' WHERE environment <> 'production';
ALTER TABLE public.company_mpesa_settings
  ALTER COLUMN environment SET DEFAULT 'production';
ALTER TABLE public.company_mpesa_settings
  DROP CONSTRAINT IF EXISTS company_mpesa_settings_environment_check;
ALTER TABLE public.company_mpesa_settings
  ADD CONSTRAINT company_mpesa_settings_environment_check CHECK (environment = 'production');

-- 2. User wallets
CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id uuid PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_self_read" ON public.user_wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_user_wallets_updated
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  source text NOT NULL,                     -- 'mpesa_topup', 'booking', 'parcel', 'refund'
  reference text,                           -- e.g. mpesa receipt or booking id
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_self_read" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- 4. STK Push requests
CREATE TABLE IF NOT EXISTS public.mpesa_stk_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  purpose text NOT NULL,                    -- 'booking', 'wallet_topup', 'parcel'
  reference_id uuid,                        -- booking/parcel/wallet target id
  phone text NOT NULL,
  amount numeric NOT NULL,
  account_reference text,
  merchant_request_id text,
  checkout_request_id text UNIQUE,
  result_code int,
  result_desc text,
  mpesa_receipt text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','cancelled')),
  raw_callback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stk_user ON public.mpesa_stk_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stk_company ON public.mpesa_stk_requests(company_id, created_at DESC);
ALTER TABLE public.mpesa_stk_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stk_self_or_company_read" ON public.mpesa_stk_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_company_staff(auth.uid(), company_id)
  );

CREATE TRIGGER trg_stk_updated
  BEFORE UPDATE ON public.mpesa_stk_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. Wallet helper functions (security definer)
CREATE OR REPLACE FUNCTION public.credit_user_wallet(_user uuid, _amount numeric, _source text, _reference text DEFAULT NULL, _meta jsonb DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal numeric;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.user_wallets (user_id, balance) VALUES (_user, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_wallets.balance + _amount, updated_at = now()
    RETURNING balance INTO _bal;
  INSERT INTO public.wallet_transactions (user_id, type, amount, source, reference, meta)
    VALUES (_user, 'credit', _amount, _source, _reference, _meta);
  RETURN _bal;
END $$;

CREATE OR REPLACE FUNCTION public.debit_user_wallet(_user uuid, _amount numeric, _source text, _reference text DEFAULT NULL, _meta jsonb DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal numeric;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.user_wallets SET balance = balance - _amount, updated_at = now()
    WHERE user_id = _user AND balance >= _amount RETURNING balance INTO _bal;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  INSERT INTO public.wallet_transactions (user_id, type, amount, source, reference, meta)
    VALUES (_user, 'debit', _amount, _source, _reference, _meta);
  RETURN _bal;
END $$;

-- 6. Update get_company_mpesa_status to drop environment toggle dependency (kept for compat)
-- (no-op, function already returns environment)
