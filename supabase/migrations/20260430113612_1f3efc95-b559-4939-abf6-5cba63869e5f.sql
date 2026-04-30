-- Add commission percentage to companies (set by super admin)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 0
  CHECK (commission_pct >= 0 AND commission_pct <= 100);

-- Discount type enum
DO $$ BEGIN
  CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-company discount codes
CREATE TABLE IF NOT EXISTS public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  description text,
  type public.discount_type NOT NULL DEFAULT 'percent',
  value numeric NOT NULL CHECK (value > 0),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY discounts_public_read_active ON public.discounts
  FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now()));

CREATE POLICY discounts_company_write ON public.discounts
  FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), 'company_admin', company_id))
  WITH CHECK (public.has_company_role(auth.uid(), 'company_admin', company_id));

CREATE POLICY discounts_super_all ON public.discounts
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_discounts_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Track discount + commission on bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_id uuid,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount numeric NOT NULL DEFAULT 0;
