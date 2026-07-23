DROP POLICY IF EXISTS "read juri" ON public.juri;
CREATE POLICY "authenticated read juri" ON public.juri FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.juri FROM anon;