
-- Restrict penilaian reads to authenticated
DROP POLICY IF EXISTS "read penilaian" ON public.penilaian;
CREATE POLICY "read penilaian" ON public.penilaian
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.penilaian FROM anon;

-- Restrict kriteria reads to authenticated
DROP POLICY IF EXISTS "read kriteria" ON public.kriteria;
CREATE POLICY "read kriteria" ON public.kriteria
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.kriteria FROM anon;

-- Restrict mazmur reads to authenticated
DROP POLICY IF EXISTS "read mazmur" ON public.mazmur;
CREATE POLICY "read mazmur" ON public.mazmur
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.mazmur FROM anon;

-- Keep public ranking view working for anonymous visitors by
-- running it with the view owner's privileges (bypasses RLS on base tables).
ALTER VIEW public.ranking SET (security_invoker = off);
GRANT SELECT ON public.ranking TO anon, authenticated;

-- Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.admin_list_juri() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_juri() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
