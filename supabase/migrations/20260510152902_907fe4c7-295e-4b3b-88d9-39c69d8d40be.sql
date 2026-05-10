
-- Company wallets
CREATE TABLE public.company_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  total_credited numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY cw_company_read ON public.company_wallets FOR SELECT TO authenticated
  USING (has_company_role(auth.uid(),'company_admin',company_id) OR is_super_admin(auth.uid()));
CREATE POLICY cw_super_all ON public.company_wallets FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- Transactions
CREATE TABLE public.company_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  source text NOT NULL,
  source_id uuid,
  gross_amount numeric,
  commission_amount numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
ALTER TABLE public.company_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cwt_company_read ON public.company_wallet_transactions FOR SELECT TO authenticated
  USING (has_company_role(auth.uid(),'company_admin',company_id) OR is_super_admin(auth.uid()));

-- Withdrawals
CREATE TABLE public.company_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'mpesa',
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  requested_by uuid,
  processed_by uuid,
  reference text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY cwd_company_read ON public.company_withdrawals FOR SELECT TO authenticated
  USING (has_company_role(auth.uid(),'company_admin',company_id) OR is_super_admin(auth.uid()));
CREATE POLICY cwd_company_insert ON public.company_withdrawals FOR INSERT TO authenticated
  WITH CHECK (has_company_role(auth.uid(),'company_admin',company_id) AND requested_by = auth.uid());
CREATE POLICY cwd_super_all ON public.company_withdrawals FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER cwd_updated BEFORE UPDATE ON public.company_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER cw_updated BEFORE UPDATE ON public.company_wallets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Credit company wallet (net of commission) — called from same triggers as platform wallet
CREATE OR REPLACE FUNCTION public.credit_company_wallet(
  _source_type text, _source_id uuid, _company_id uuid, _gross numeric, _pct numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _commission numeric; _net numeric;
BEGIN
  _commission := round((COALESCE(_gross,0) * COALESCE(_pct,0) / 100.0)::numeric, 2);
  _net := COALESCE(_gross,0) - _commission;
  IF _net <= 0 THEN RETURN; END IF;

  BEGIN
    INSERT INTO public.company_wallet_transactions
      (company_id, type, amount, source, source_id, gross_amount, commission_amount, note)
    VALUES (_company_id, 'credit', _net, _source_type, _source_id, _gross, _commission,
            'Auto credit from '||_source_type||' payment');
  EXCEPTION WHEN unique_violation THEN RETURN; END;

  INSERT INTO public.company_wallets (company_id, balance, total_credited)
  VALUES (_company_id, _net, _net)
  ON CONFLICT (company_id) DO UPDATE
    SET balance = public.company_wallets.balance + _net,
        total_credited = public.company_wallets.total_credited + _net,
        updated_at = now();
END $$;

-- Update existing wallet triggers to also credit company wallet
CREATE OR REPLACE FUNCTION public.tg_wallet_booking_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pct numeric;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT commission_pct INTO _pct FROM public.companies WHERE id = NEW.company_id;
    PERFORM public.credit_platform_wallet('booking', NEW.id, NEW.company_id, NEW.amount, COALESCE(_pct,0));
    PERFORM public.credit_company_wallet('booking', NEW.id, NEW.company_id, NEW.amount, COALESCE(_pct,0));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_wallet_parcel_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pct numeric;
BEGIN
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    SELECT commission_pct INTO _pct FROM public.companies WHERE id = NEW.company_id;
    PERFORM public.credit_platform_wallet('parcel', NEW.id, NEW.company_id, NEW.price, COALESCE(_pct,0));
    PERFORM public.credit_company_wallet('parcel', NEW.id, NEW.company_id, NEW.price, COALESCE(_pct,0));
  END IF;
  RETURN NEW;
END $$;

-- Withdrawal request: debits the wallet immediately (holds funds)
CREATE OR REPLACE FUNCTION public.request_company_withdrawal(
  _company_id uuid, _amount numeric, _method text, _destination text, _note text DEFAULT NULL
) RETURNS company_withdrawals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w public.company_withdrawals; _bal numeric;
BEGIN
  IF NOT has_company_role(auth.uid(),'company_admin',_company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  UPDATE public.company_wallets
     SET balance = balance - _amount,
         total_withdrawn = total_withdrawn + _amount,
         updated_at = now()
   WHERE company_id = _company_id AND balance >= _amount
   RETURNING balance INTO _bal;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  INSERT INTO public.company_withdrawals
    (company_id, amount, method, destination, requested_by, note)
  VALUES (_company_id, _amount, _method, _destination, auth.uid(), _note)
  RETURNING * INTO _w;

  INSERT INTO public.company_wallet_transactions
    (company_id, type, amount, source, source_id, note)
  VALUES (_company_id, 'debit', _amount, 'withdrawal', _w.id, 'Withdrawal request: '||_method||' '||_destination);

  RETURN _w;
END $$;

-- Super admin marks as paid / rejected (refunds on reject)
CREATE OR REPLACE FUNCTION public.process_company_withdrawal(
  _withdrawal_id uuid, _new_status text, _reference text DEFAULT NULL
) RETURNS company_withdrawals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w public.company_withdrawals;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _new_status NOT IN ('approved','paid','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  SELECT * INTO _w FROM public.company_withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _w.status IN ('paid','rejected') THEN RAISE EXCEPTION 'Already finalized'; END IF;

  IF _new_status = 'rejected' THEN
    UPDATE public.company_wallets
      SET balance = balance + _w.amount,
          total_withdrawn = total_withdrawn - _w.amount,
          updated_at = now()
      WHERE company_id = _w.company_id;
    INSERT INTO public.company_wallet_transactions (company_id, type, amount, source, source_id, note)
    VALUES (_w.company_id, 'credit', _w.amount, 'withdrawal_refund', _w.id, 'Withdrawal rejected — refunded');
  END IF;

  UPDATE public.company_withdrawals
    SET status = _new_status, processed_by = auth.uid(),
        reference = COALESCE(_reference, reference), updated_at = now()
   WHERE id = _withdrawal_id RETURNING * INTO _w;
  RETURN _w;
END $$;
