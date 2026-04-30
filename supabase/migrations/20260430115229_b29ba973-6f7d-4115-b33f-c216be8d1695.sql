-- Pin search_path on remaining functions
CREATE OR REPLACE FUNCTION public.generate_parcel_tracking_id()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'PRC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
$$;

-- Restrict staff-only RPCs to authenticated users
REVOKE EXECUTE ON FUNCTION public.update_parcel_status(uuid, public.parcel_status, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_parcel_pickup(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_parcel_paid(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_staff(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_parcel_status(uuid, public.parcel_status, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_parcel_pickup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_parcel_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_staff(uuid, uuid) TO authenticated;