DROP POLICY IF EXISTS "read var session scoped" ON public.var_clarification_session;

CREATE POLICY "read var session scoped"
ON public.var_clarification_session
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'panitia'::app_role)
  OR public.has_role(auth.uid(), 'inspektur'::app_role)
  OR public.has_role(auth.uid(), 'ketua_juri'::app_role)
  OR public.has_role(auth.uid(), 'juri'::app_role)
);