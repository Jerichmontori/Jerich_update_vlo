CREATE OR REPLACE FUNCTION public.get_branding()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value FROM public.system_config WHERE key = 'branding'), '{}'::jsonb)
$$;

REVOKE ALL ON FUNCTION public.get_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_branding() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_branding(_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah tampilan';
  END IF;
  INSERT INTO public.system_config (key, value)
  VALUES ('branding', COALESCE(_value, '{}'::jsonb))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN COALESCE(_value, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.set_branding(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_branding(jsonb) TO authenticated;