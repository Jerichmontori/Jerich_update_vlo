
-- Restrict system_config reads to admin/panitia
DROP POLICY IF EXISTS "read system_config authenticated" ON public.system_config;
CREATE POLICY "read system_config admin panitia"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'panitia'::app_role));

-- Revoke EXECUTE from anon and PUBLIC on all SECURITY DEFINER functions in public
REVOKE EXECUTE ON FUNCTION public.get_var_aktif() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_penilaian() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mulai_sesi(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.after_submission_detect_var() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mulai_klarifikasi_var(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ubah_mazmur_sesi(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ranking() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_klarifikasi_status(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_klarifikasi_var(uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hitung_nilai_juri(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hitung_nilai_akhir(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.akhiri_sesi(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.detect_potensi_var(uuid) FROM anon, PUBLIC;

-- Ensure authenticated retains execute where needed
GRANT EXECUTE ON FUNCTION public.get_ranking() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hitung_nilai_juri(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hitung_nilai_akhir(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_var_aktif() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_penilaian() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mulai_sesi(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mulai_klarifikasi_var(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ubah_mazmur_sesi(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_klarifikasi_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_klarifikasi_var(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.akhiri_sesi(uuid) TO authenticated;
