
CREATE OR REPLACE FUNCTION public.admin_reset_all_penilaian()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: hanya admin';
  END IF;
  DELETE FROM public.penilaian_submission WHERE true;
  DELETE FROM public.penilaian WHERE true;
END;
$$;
