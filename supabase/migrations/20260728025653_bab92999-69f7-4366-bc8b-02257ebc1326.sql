GRANT SELECT, INSERT, UPDATE, DELETE ON public.penilaian_submission TO authenticated;
GRANT ALL ON public.penilaian_submission TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;