REVOKE SELECT (email) ON public.juri FROM authenticated;
REVOKE ALL ON public.juri FROM anon;

DROP POLICY IF EXISTS "authenticated read juri roster" ON public.juri;

CREATE POLICY "staff read juri roster"
ON public.juri
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));