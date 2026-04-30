-- Add parcel_clerk role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parcel_clerk';

-- Enums for parcels
DO $$ BEGIN
  CREATE TYPE public.parcel_status AS ENUM (
    'created','paid','dispatched','in_transit','arrived','ready_for_pickup','delivered','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.parcel_payment_status AS ENUM ('pending','paid','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ BRANCHES ============
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  town text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branches_company ON public.branches(company_id);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY branches_public_read ON public.branches FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY branches_company_write ON public.branches FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(),'company_admin', company_id))
  WITH CHECK (public.has_company_role(auth.uid(),'company_admin', company_id));
CREATE POLICY branches_super_all ON public.branches FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ ROUTE PARCEL PRICING ============
CREATE TABLE IF NOT EXISTS public.route_parcel_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL UNIQUE,
  company_id uuid NOT NULL,
  base_fee numeric NOT NULL DEFAULT 0,
  per_kg numeric NOT NULL DEFAULT 0,
  urgent_surcharge numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.route_parcel_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY rpp_public_read ON public.route_parcel_pricing FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY rpp_company_write ON public.route_parcel_pricing FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(),'company_admin', company_id))
  WITH CHECK (public.has_company_role(auth.uid(),'company_admin', company_id));
CREATE POLICY rpp_super_all ON public.route_parcel_pricing FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_rpp_updated BEFORE UPDATE ON public.route_parcel_pricing
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PARCELS ============
CREATE TABLE IF NOT EXISTS public.parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id text NOT NULL UNIQUE,
  company_id uuid NOT NULL,
  route_id uuid NOT NULL,
  trip_id uuid,
  origin_branch_id uuid,
  destination_branch_id uuid,
  sender_name text NOT NULL,
  sender_phone text NOT NULL,
  sender_id_number text,
  receiver_name text NOT NULL,
  receiver_phone text NOT NULL,
  description text NOT NULL,
  weight_kg numeric NOT NULL DEFAULT 1,
  quantity integer NOT NULL DEFAULT 1,
  declared_value numeric,
  is_urgent boolean NOT NULL DEFAULT false,
  price numeric NOT NULL DEFAULT 0,
  status public.parcel_status NOT NULL DEFAULT 'created',
  payment_status public.parcel_payment_status NOT NULL DEFAULT 'pending',
  pickup_otp text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parcels_company ON public.parcels(company_id);
CREATE INDEX IF NOT EXISTS idx_parcels_trip ON public.parcels(trip_id);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON public.parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_phones ON public.parcels(sender_phone, receiver_phone);

ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY parcels_public_create ON public.parcels FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'created' AND payment_status = 'pending');
CREATE POLICY parcels_company_read ON public.parcels FOR SELECT TO authenticated
  USING (company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY parcels_company_update ON public.parcels FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_parcels_updated BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ MOVEMENTS ============
CREATE TABLE IF NOT EXISTS public.parcel_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  status public.parcel_status NOT NULL,
  location text,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_parcel ON public.parcel_movements(parcel_id, created_at);
ALTER TABLE public.parcel_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY movements_public_read ON public.parcel_movements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY movements_staff_write ON public.parcel_movements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_movements.parcel_id
      AND (p.company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()))
  ));

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS public.parcel_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  mpesa_code text,
  status public.parcel_payment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pp_parcel ON public.parcel_payments(parcel_id);
ALTER TABLE public.parcel_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_company_all ON public.parcel_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_payments.parcel_id
    AND (p.company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_payments.parcel_id
    AND (p.company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()))));

-- ============ FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.generate_parcel_tracking_id()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'PRC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
$$;

CREATE OR REPLACE FUNCTION public.is_company_staff(_user uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user)
    OR public.has_company_role(_user,'company_admin',_company)
    OR public.has_company_role(_user,'parcel_clerk',_company);
$$;

CREATE OR REPLACE FUNCTION public.create_parcel(
  _route_id uuid,
  _origin_branch uuid,
  _destination_branch uuid,
  _sender_name text, _sender_phone text, _sender_id text,
  _receiver_name text, _receiver_phone text,
  _description text, _weight numeric, _quantity integer,
  _declared_value numeric, _is_urgent boolean,
  _trip_id uuid DEFAULT NULL
) RETURNS public.parcels
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _company uuid;
  _pricing public.route_parcel_pricing;
  _price numeric;
  _otp text := lpad((floor(random()*1000000))::int::text, 6, '0');
  _tracking text;
  _p public.parcels;
BEGIN
  IF _weight <= 0 OR _quantity <= 0 THEN RAISE EXCEPTION 'Invalid weight or quantity'; END IF;
  SELECT company_id INTO _company FROM public.routes WHERE id = _route_id AND is_active = true;
  IF _company IS NULL THEN RAISE EXCEPTION 'Route not found'; END IF;

  SELECT * INTO _pricing FROM public.route_parcel_pricing WHERE route_id = _route_id AND is_active = true;
  IF _pricing.id IS NULL THEN RAISE EXCEPTION 'No pricing set for this route'; END IF;

  _price := _pricing.base_fee + (_pricing.per_kg * _weight * _quantity)
            + (CASE WHEN _is_urgent THEN _pricing.urgent_surcharge ELSE 0 END);

  LOOP
    _tracking := public.generate_parcel_tracking_id();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.parcels WHERE tracking_id = _tracking);
  END LOOP;

  INSERT INTO public.parcels (
    tracking_id, company_id, route_id, trip_id,
    origin_branch_id, destination_branch_id,
    sender_name, sender_phone, sender_id_number,
    receiver_name, receiver_phone,
    description, weight_kg, quantity, declared_value, is_urgent,
    price, pickup_otp, created_by
  ) VALUES (
    _tracking, _company, _route_id, _trip_id,
    _origin_branch, _destination_branch,
    _sender_name, _sender_phone, _sender_id,
    _receiver_name, _receiver_phone,
    _description, _weight, _quantity, _declared_value, COALESCE(_is_urgent,false),
    _price, _otp, auth.uid()
  ) RETURNING * INTO _p;

  INSERT INTO public.parcel_movements (parcel_id, status, location, note, actor_id)
  VALUES (_p.id, 'created', NULL, 'Parcel registered', auth.uid());

  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.update_parcel_status(
  _parcel_id uuid, _new_status public.parcel_status, _location text DEFAULT NULL, _note text DEFAULT NULL
) RETURNS public.parcels
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parcels;
BEGIN
  SELECT * INTO _p FROM public.parcels WHERE id = _parcel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF NOT public.is_company_staff(auth.uid(), _p.company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.parcels SET status = _new_status WHERE id = _parcel_id RETURNING * INTO _p;
  INSERT INTO public.parcel_movements (parcel_id, status, location, note, actor_id)
  VALUES (_parcel_id, _new_status, _location, _note, auth.uid());
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.verify_parcel_pickup(_parcel_id uuid, _otp text)
RETURNS public.parcels
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parcels;
BEGIN
  SELECT * INTO _p FROM public.parcels WHERE id = _parcel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF NOT public.is_company_staff(auth.uid(), _p.company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _p.status = 'delivered' THEN RETURN _p; END IF;
  IF _p.status NOT IN ('arrived','ready_for_pickup') THEN
    RAISE EXCEPTION 'Parcel not yet ready for pickup';
  END IF;
  IF _p.pickup_otp <> _otp THEN RAISE EXCEPTION 'Invalid pickup code'; END IF;

  UPDATE public.parcels SET status = 'delivered' WHERE id = _parcel_id RETURNING * INTO _p;
  INSERT INTO public.parcel_movements (parcel_id, status, location, note, actor_id)
  VALUES (_parcel_id, 'delivered', NULL, 'Pickup verified via OTP', auth.uid());
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.mark_parcel_paid(_parcel_id uuid, _mpesa_code text)
RETURNS public.parcels
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parcels;
BEGIN
  SELECT * INTO _p FROM public.parcels WHERE id = _parcel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;
  IF NOT public.is_company_staff(auth.uid(), _p.company_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO public.parcel_payments (parcel_id, amount, mpesa_code, status)
  VALUES (_parcel_id, _p.price, _mpesa_code, 'paid');

  UPDATE public.parcels SET payment_status = 'paid', status =
    CASE WHEN status = 'created' THEN 'paid'::public.parcel_status ELSE status END
  WHERE id = _parcel_id RETURNING * INTO _p;

  INSERT INTO public.parcel_movements (parcel_id, status, location, note, actor_id)
  VALUES (_parcel_id, _p.status, NULL, 'Payment received: '||COALESCE(_mpesa_code,'(stub)'), auth.uid());
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.track_parcel(_tracking_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parcels; _movements jsonb; _route record; _company record;
BEGIN
  SELECT * INTO _p FROM public.parcels WHERE tracking_id = _tracking_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT origin, destination INTO _route FROM public.routes WHERE id = _p.route_id;
  SELECT name INTO _company FROM public.companies WHERE id = _p.company_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'status', status, 'location', location, 'note', note, 'created_at', created_at
  ) ORDER BY created_at), '[]'::jsonb) INTO _movements
  FROM public.parcel_movements WHERE parcel_id = _p.id;

  RETURN jsonb_build_object(
    'tracking_id', _p.tracking_id,
    'status', _p.status,
    'payment_status', _p.payment_status,
    'price', _p.price,
    'sender_name', _p.sender_name,
    'receiver_name', _p.receiver_name,
    'description', _p.description,
    'weight_kg', _p.weight_kg,
    'company', _company.name,
    'origin', _route.origin,
    'destination', _route.destination,
    'created_at', _p.created_at,
    'movements', _movements
  );
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcel_movements;