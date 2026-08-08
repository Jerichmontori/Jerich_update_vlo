ALTER TABLE public.juri ADD COLUMN IF NOT EXISTS aktif_menilai boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.juri_in_pool(_juri uuid, _peserta uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.juri
     WHERE id = _juri AND approved = true AND role = 'juri'::app_role
       AND aktif_menilai = true
       AND is_dummy = public.is_peserta_uji(_peserta)
  );
$function$;

CREATE OR REPLACE FUNCTION public.juri_pool_count(_peserta uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*) FROM public.juri
   WHERE approved = true AND role = 'juri'::app_role
     AND aktif_menilai = true
     AND is_dummy = public.is_peserta_uji(_peserta);
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_juri_aktif(_juri uuid, _aktif boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah status juri penilai';
  END IF;
  UPDATE public.juri SET aktif_menilai = _aktif WHERE id = _juri;
  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), CASE WHEN _aktif THEN 'juri_aktifkan_menilai' ELSE 'juri_nonaktifkan_menilai' END,
          jsonb_build_object('juri_id', _juri));
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_juri_aktif(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_juri_aktif(uuid, boolean) TO authenticated;