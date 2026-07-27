-- Recreate view as security invoker
DROP VIEW IF EXISTS public.juri_public;
CREATE VIEW public.juri_public
WITH (security_invoker = on) AS
SELECT id, nama, jabatan, role, approved, bacaan_mazmur, jumlah_ayat, created_at
FROM public.juri;

GRANT SELECT ON public.juri_public TO authenticated;

-- Allow authenticated to see approved juri rows (needed for scoring dropdown / dashboard progress)
CREATE POLICY "authenticated read approved juri"
ON public.juri
FOR SELECT
TO authenticated
USING (approved = true);

-- Column-level privileges: hide email from generic authenticated reads.
-- Admin path uses a SECURITY DEFINER function below.
REVOKE SELECT ON public.juri FROM authenticated;
GRANT SELECT (id, nama, jabatan, role, approved, bacaan_mazmur, jumlah_ayat, created_at, user_id)
  ON public.juri TO authenticated;

-- Admin-only listing including email
CREATE OR REPLACE FUNCTION public.admin_list_juri()
RETURNS SETOF public.juri
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.juri ORDER BY created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_juri() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_juri() TO authenticated;