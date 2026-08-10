CREATE OR REPLACE FUNCTION public.get_sesi_tampil()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF((value #>> '{}'), '')::integer
  FROM public.system_config
  WHERE key = 'sesi_tampil'
$$;

CREATE OR REPLACE FUNCTION public.set_sesi_tampil(_sesi integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer')) THEN
    RAISE EXCEPTION 'Tidak diizinkan';
  END IF;

  INSERT INTO public.system_config(key, value)
  VALUES ('sesi_tampil', to_jsonb(_sesi))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN _sesi;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sesi_tampil() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_sesi_tampil(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sesi_tampil() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sesi_tampil(integer) TO authenticated;