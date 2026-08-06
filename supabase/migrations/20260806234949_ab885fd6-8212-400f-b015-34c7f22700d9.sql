-- 1. Make the view respect the querying user's permissions
ALTER VIEW public.juri_public SET (security_invoker = true);

-- 2. Column-level privileges: authenticated users may read only non-sensitive columns
REVOKE SELECT ON public.juri FROM authenticated;
GRANT SELECT (id, nama, jabatan, role, approved, bacaan_mazmur, jumlah_ayat, created_at, is_dummy, user_id)
  ON public.juri TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.juri TO authenticated;
GRANT ALL ON public.juri TO service_role;
GRANT SELECT ON public.juri_public TO authenticated;

-- 3. Allow signed-in users to read the roster rows (columns still restricted above)
DROP POLICY IF EXISTS "authenticated read juri roster" ON public.juri;
CREATE POLICY "authenticated read juri roster"
  ON public.juri FOR SELECT TO authenticated
  USING (true);