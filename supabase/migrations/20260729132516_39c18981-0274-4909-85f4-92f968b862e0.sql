-- penilaian_submission
DROP POLICY IF EXISTS "authenticated read submission" ON public.penilaian_submission;
CREATE POLICY "read submission scoped" ON public.penilaian_submission
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'panitia')
  OR has_role(auth.uid(),'inspektur') OR has_role(auth.uid(),'ketua_juri')
  OR juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid())
);

-- sesi_penilaian
DROP POLICY IF EXISTS "read sesi_penilaian authenticated" ON public.sesi_penilaian;
CREATE POLICY "read sesi scoped" ON public.sesi_penilaian
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'panitia')
  OR has_role(auth.uid(),'inspektur') OR has_role(auth.uid(),'ketua_juri')
  OR has_role(auth.uid(),'juri')
);

-- var_clarification_session
DROP POLICY IF EXISTS "read var session authenticated" ON public.var_clarification_session;
CREATE POLICY "read var session scoped" ON public.var_clarification_session
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'panitia')
  OR has_role(auth.uid(),'inspektur') OR has_role(auth.uid(),'ketua_juri')
  OR EXISTS (
    SELECT 1 FROM public.penilaian_submission ps
    WHERE ps.peserta_id = var_clarification_session.peserta_id
      AND ps.juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- var_clarification_response
DROP POLICY IF EXISTS "read var response authenticated" ON public.var_clarification_response;
CREATE POLICY "read var response scoped" ON public.var_clarification_response
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'panitia')
  OR has_role(auth.uid(),'inspektur') OR has_role(auth.uid(),'ketua_juri')
  OR juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid())
);