CREATE OR REPLACE FUNCTION public.admin_list_penilaian()
RETURNS SETOF public.penilaian
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.penilaian;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_penilaian() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_penilaian() TO authenticated;