
-- Wallet balance (single row)
CREATE TABLE IF NOT EXISTS public.platform_wallet_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance numeric NOT NULL DEFAULT 0,
  total_credited numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_wallet_balance (balance, total_credited)
SELECT 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.platform_wallet_balance);

ALTER TABLE public.platform_wallet_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_balance_super_read" ON public.platform_wallet_balance
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- Wallet transactions
CREATE TABLE IF NOT EXISTS public.platform_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('booking','parcel')),
  source_id uuid NOT NULL,
  company_id uuid,
  gross_amount numeric NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

ALTER TABLE public.platform_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_tx_super_read" ON public.platform_wallet_transactions
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_wallet_tx_company ON public.platform_wallet_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON public.platform_wallet_transactions(created_at DESC);

-- Helper: credit wallet
CREATE OR REPLACE FUNCTION public.credit_platform_wallet(
  _source_type text, _source_id uuid, _company_id uuid,
  _gross numeric, _pct numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _commission numeric;
BEGIN
  _commission := round((COALESCE(_gross,0) * COALESCE(_pct,0) / 100.0)::numeric, 2);
  IF _commission <= 0 THEN RETURN; END IF;

  BEGIN
    INSERT INTO public.platform_wallet_transactions
      (source_type, source_id, company_id, gross_amount, commission_pct, commission_amount)
    VALUES (_source_type, _source_id, _company_id, _gross, _pct, _commission);
  EXCEPTION WHEN unique_violation THEN
    RETURN; -- already credited
  END;

  UPDATE public.platform_wallet_balance
     SET balance = balance + _commission,
         total_credited = total_credited + _commission,
         updated_at = now();
END $$;

-- Booking trigger: on transition to paid
CREATE OR REPLACE FUNCTION public.tg_wallet_booking_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pct numeric;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT commission_pct INTO _pct FROM public.companies WHERE id = NEW.company_id;
    PERFORM public.credit_platform_wallet('booking', NEW.id, NEW.company_id, NEW.amount, COALESCE(_pct,0));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wallet_booking_paid ON public.bookings;
CREATE TRIGGER trg_wallet_booking_paid
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_wallet_booking_paid();

-- Parcel trigger: on payment_status -> paid
CREATE OR REPLACE FUNCTION public.tg_wallet_parcel_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pct numeric;
BEGIN
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    SELECT commission_pct INTO _pct FROM public.companies WHERE id = NEW.company_id;
    PERFORM public.credit_platform_wallet('parcel', NEW.id, NEW.company_id, NEW.price, COALESCE(_pct,0));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wallet_parcel_paid ON public.parcels;
CREATE TRIGGER trg_wallet_parcel_paid
AFTER INSERT OR UPDATE OF payment_status ON public.parcels
FOR EACH ROW EXECUTE FUNCTION public.tg_wallet_parcel_paid();

-- Backfill existing paid bookings & parcels
DO $$
DECLARE r record; _pct numeric;
BEGIN
  FOR r IN SELECT id, company_id, amount FROM public.bookings WHERE status = 'paid' LOOP
    SELECT commission_pct INTO _pct FROM public.companies WHERE id = r.company_id;
    PERFORM public.credit_platform_wallet('booking', r.id, r.company_id, r.amount, COALESCE(_pct,0));
  END LOOP;
  FOR r IN SELECT id, company_id, price FROM public.parcels WHERE payment_status = 'paid' LOOP
    SELECT commission_pct INTO _pct FROM public.companies WHERE id = r.company_id;
    PERFORM public.credit_platform_wallet('parcel', r.id, r.company_id, r.price, COALESCE(_pct,0));
  END LOOP;
END $$;
