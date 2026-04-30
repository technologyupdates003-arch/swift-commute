-- ============================================================
-- BUS BOOKING SAAS - PHASE 1 SCHEMA (multi-tenant ready)
-- ============================================================

-- Roles enum (system-wide)
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'company_admin',
  'cashier',
  'parcel_clerk',
  'driver',
  'conductor',
  'customer'
);

CREATE TYPE public.bus_type AS ENUM ('vip', 'normal');
CREATE TYPE public.trip_status AS ENUM ('scheduled', 'departed', 'completed', 'cancelled');
CREATE TYPE public.booking_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');

-- Companies (tenants)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (one per auth user)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name TEXT,
  phone TEXT,
  national_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (NEVER store role on profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.get_user_company(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_user_id UUID, _role public.app_role, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND company_id = _company_id
  );
$$;

-- Buses
CREATE TABLE public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0 AND capacity <= 80),
  bus_type public.bus_type NOT NULL DEFAULT 'normal',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, plate_number)
);

-- Routes
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trips (scheduled departures)
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  departure_at TIMESTAMPTZ NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  status public.trip_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  seat_number INT NOT NULL CHECK (seat_number > 0),
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  passenger_id_number TEXT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  status public.booking_status NOT NULL DEFAULT 'pending',
  ticket_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, seat_number)
);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings    ENABLE ROW LEVEL SECURITY;

-- companies: super_admin all; everyone can read active companies (needed for public portal display)
CREATE POLICY "companies_super_all" ON public.companies FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "companies_public_read_active" ON public.companies FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);
CREATE POLICY "companies_member_read" ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company(auth.uid()));

-- profiles: user reads/updates own; super_admin reads all
CREATE POLICY "profiles_self_read"   ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_super_write" ON public.profiles FOR ALL    TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- user_roles: user reads own; super_admin manages all
CREATE POLICY "roles_self_read"  ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "roles_super_all"  ON public.user_roles FOR ALL    TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- buses: company members read; company_admin write; super_admin all
CREATE POLICY "buses_super_all"     ON public.buses FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "buses_company_read"  ON public.buses FOR SELECT TO authenticated USING (company_id = public.get_user_company(auth.uid()));
CREATE POLICY "buses_company_write" ON public.buses FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), 'company_admin', company_id))
  WITH CHECK (public.has_company_role(auth.uid(), 'company_admin', company_id));

-- routes: public read of active routes (for public search), company write
CREATE POLICY "routes_public_read"   ON public.routes FOR SELECT TO anon, authenticated USING (is_active = TRUE);
CREATE POLICY "routes_super_all"     ON public.routes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "routes_company_write" ON public.routes FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), 'company_admin', company_id))
  WITH CHECK (public.has_company_role(auth.uid(), 'company_admin', company_id));

-- trips: public read scheduled trips, company write
CREATE POLICY "trips_public_read"    ON public.trips FOR SELECT TO anon, authenticated USING (status = 'scheduled' OR company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "trips_super_all"      ON public.trips FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "trips_company_write"  ON public.trips FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), 'company_admin', company_id))
  WITH CHECK (public.has_company_role(auth.uid(), 'company_admin', company_id));

-- bookings: anyone can create (public booking) and read their own by phone is not RLS-friendly,
-- so: allow anon insert with status pending; reads restricted to company staff or super admin or the creator.
CREATE POLICY "bookings_public_create" ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY "bookings_company_read"  ON public.bookings FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR created_by = auth.uid()
  );
CREATE POLICY "bookings_company_update" ON public.bookings FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Helpful indexes
CREATE INDEX idx_buses_company   ON public.buses(company_id);
CREATE INDEX idx_routes_company  ON public.routes(company_id);
CREATE INDEX idx_trips_company   ON public.trips(company_id);
CREATE INDEX idx_trips_route     ON public.trips(route_id);
CREATE INDEX idx_trips_departure ON public.trips(departure_at);
CREATE INDEX idx_bookings_trip   ON public.bookings(trip_id);
CREATE INDEX idx_bookings_company ON public.bookings(company_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);