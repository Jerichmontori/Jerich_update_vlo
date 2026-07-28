
-- 1) Perluas SELECT penilaian_submission agar semua juri terautentikasi bisa melihat siapa saja yang sudah mengirim.
DROP POLICY IF EXISTS "read submission own or admin" ON public.penilaian_submission;
CREATE POLICY "authenticated read submission"
  ON public.penilaian_submission
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) RPC reset semua penilaian (admin only, SECURITY DEFINER agar tidak terhalang RLS)
CREATE OR REPLACE FUNCTION public.admin_reset_all_penilaian()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: hanya admin';
  END IF;
  DELETE FROM public.penilaian_submission;
  DELETE FROM public.penilaian;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_all_penilaian() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_penilaian() TO authenticated;
