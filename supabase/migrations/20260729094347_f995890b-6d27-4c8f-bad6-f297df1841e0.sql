CREATE OR REPLACE FUNCTION public.get_submission_progress(_peserta uuid)
RETURNS TABLE(done_count bigint, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      SELECT count(DISTINCT ps.juri_id)
      FROM public.penilaian_submission ps
      JOIN public.juri j ON j.id = ps.juri_id
      WHERE ps.peserta_id = _peserta
        AND j.approved = true
        AND j.role = 'juri'::app_role
    )::bigint AS done_count,
    (
      SELECT count(*)
      FROM public.juri j
      WHERE j.approved = true
        AND j.role = 'juri'::app_role
    )::bigint AS total_count;
$$;

REVOKE ALL ON FUNCTION public.get_submission_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_submission_progress(uuid) TO authenticated;