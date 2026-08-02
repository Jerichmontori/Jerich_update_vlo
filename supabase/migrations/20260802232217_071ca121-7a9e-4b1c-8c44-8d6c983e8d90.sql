DROP POLICY IF EXISTS "auth read live_ranking_sesi" ON public.live_ranking_sesi;
CREATE POLICY "staff read live_ranking_sesi"
ON public.live_ranking_sesi
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'panitia')
  OR public.has_role(auth.uid(),'inspektur')
  OR public.has_role(auth.uid(),'ketua_juri')
);

DROP POLICY IF EXISTS "auth read live_ranking_vote" ON public.live_ranking_vote;
CREATE POLICY "staff or owner read live_ranking_vote"
ON public.live_ranking_vote
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'panitia')
  OR public.has_role(auth.uid(),'inspektur')
  OR public.has_role(auth.uid(),'ketua_juri')
  OR juri_id = (SELECT p.juri_id FROM public.profiles p WHERE p.id = auth.uid())
);