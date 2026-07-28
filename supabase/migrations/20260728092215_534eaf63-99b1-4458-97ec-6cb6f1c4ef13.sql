CREATE OR REPLACE FUNCTION public.admin_reset_all_penilaian()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: hanya admin';
  END IF;
  DELETE FROM public.var_clarification_response WHERE true;
  DELETE FROM public.var_clarification_session WHERE true;
  DELETE FROM public.var_review WHERE true;
  DELETE FROM public.penilaian_submission WHERE true;
  DELETE FROM public.penilaian WHERE true;
  DELETE FROM public.sesi_penilaian WHERE true;
  DELETE FROM public.operator_audit_log WHERE true;
END;
$function$;