REVOKE EXECUTE ON FUNCTION public.create_api_key(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_api_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_api_key(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;