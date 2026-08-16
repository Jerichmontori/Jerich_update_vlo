CREATE OR REPLACE FUNCTION public.refresh_nilai_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menghitung ulang nilai';
  END IF;

  UPDATE public.penilaian_submission ps
     SET nilai_cache = public.hitung_nilai_juri(ps.peserta_id, ps.juri_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_nilai_cache() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_nilai_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_nilai_cache() TO service_role;

REVOKE ALL ON FUNCTION public.admin_set_pita_nilai(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pita_nilai(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_pita_nilai(text, jsonb) TO service_role;