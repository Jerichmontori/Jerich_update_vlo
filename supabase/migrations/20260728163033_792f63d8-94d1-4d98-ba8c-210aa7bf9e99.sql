GRANT EXECUTE ON FUNCTION public.inspektur_var_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_monitor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_list_var() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_ringkasan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_buka_perhatian(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_selesaikan_var(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_terapkan_perbaikan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_catat(uuid, text, text) TO authenticated;