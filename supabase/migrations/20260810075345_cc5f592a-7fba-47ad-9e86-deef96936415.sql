
REVOKE EXECUTE ON FUNCTION public.ip_putuskan_keberatan(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ip2_ajukan_peninjauan(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_putuskan_peninjauan(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ip2_putuskan_var(uuid, boolean, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.var_berita_acara(uuid) FROM anon;
