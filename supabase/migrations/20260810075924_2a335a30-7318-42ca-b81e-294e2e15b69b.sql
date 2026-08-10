
CREATE OR REPLACE FUNCTION public.is_vmix_viewer(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role::text IN ('admin','inspektur','inspektur_var','operator_vmix')
  );
$$;
