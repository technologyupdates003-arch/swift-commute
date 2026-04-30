-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  company_id uuid,
  actor_id uuid,
  before jsonb,
  after jsonb,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_super_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
-- No insert/update/delete policies — only SECURITY DEFINER triggers can write.

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text, _entity text, _entity_id uuid, _company_id uuid DEFAULT NULL, _meta jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, meta)
  VALUES (_action, _entity, _entity_id, _company_id, auth.uid(), _meta);
END $$;

REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, uuid, jsonb) TO authenticated;

-- ============ TRIGGER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.tg_audit_companies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, after)
    VALUES ('company.created','company',NEW.id,NEW.id,auth.uid(),to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_active <> OLD.is_active THEN
      INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, before, after)
      VALUES (CASE WHEN NEW.is_active THEN 'company.activated' ELSE 'company.suspended' END,
              'company', NEW.id, NEW.id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    IF NEW.commission_pct <> OLD.commission_pct THEN
      INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, before, after)
      VALUES ('company.commission_changed','company',NEW.id,NEW.id,auth.uid(),
              jsonb_build_object('commission_pct',OLD.commission_pct),
              jsonb_build_object('commission_pct',NEW.commission_pct));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_audit_bookings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, after)
    VALUES ('booking.created','booking',NEW.id,NEW.company_id,auth.uid(),
      jsonb_build_object('amount',NEW.amount,'status',NEW.status,'seat',NEW.seat_number));
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, before, after)
    VALUES ('booking.status_changed','booking',NEW.id,NEW.company_id,auth.uid(),
      jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_audit_parcels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, after)
    VALUES ('parcel.created','parcel',NEW.id,NEW.company_id,auth.uid(),
      jsonb_build_object('tracking_id',NEW.tracking_id,'price',NEW.price));
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, before, after)
    VALUES ('parcel.status_changed','parcel',NEW.id,NEW.company_id,auth.uid(),
      jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_audit_parcel_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _co uuid;
BEGIN
  SELECT company_id INTO _co FROM public.parcels WHERE id = NEW.parcel_id;
  INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, after)
  VALUES ('parcel.payment','parcel_payment',NEW.id,_co,auth.uid(),
    jsonb_build_object('amount',NEW.amount,'mpesa_code',NEW.mpesa_code,'status',NEW.status));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_audit_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, after)
    VALUES ('role.granted','user_role',NEW.id,NEW.company_id,auth.uid(),to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (action, entity, entity_id, company_id, actor_id, before)
    VALUES ('role.revoked','user_role',OLD.id,OLD.company_id,auth.uid(),to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

-- ============ ATTACH TRIGGERS ============
DROP TRIGGER IF EXISTS audit_companies ON public.companies;
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_companies();

DROP TRIGGER IF EXISTS audit_bookings ON public.bookings;
CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_bookings();

DROP TRIGGER IF EXISTS audit_parcels ON public.parcels;
CREATE TRIGGER audit_parcels AFTER INSERT OR UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_parcels();

DROP TRIGGER IF EXISTS audit_parcel_payments ON public.parcel_payments;
CREATE TRIGGER audit_parcel_payments AFTER INSERT ON public.parcel_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_parcel_payments();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_user_roles();