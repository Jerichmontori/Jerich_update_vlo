DO $$
DECLARE
  r record;
  anon_fns text[] := ARRAY[
    'get_branding','get_ranking','public_live_state','public_pengumuman_state',
    'keberatan_status','keberatan_window','get_keberatan_deadline'
  ];
  auth_fns text[] := ARRAY[
    'admin_buka_penilaian_ulang','admin_list_juri','admin_list_penilaian','admin_putuskan_peninjauan',
    'admin_reset_all_penilaian','admin_set_juri_aktif','get_branding','get_keberatan_deadline',
    'get_live_ranking_kategori','get_live_ranking_top10','get_ranking','get_sesi_tampil',
    'get_submission_progress','get_var_manual_pending','has_role','hitung_nilai_akhir','hitung_nilai_juri',
    'inspektur_ajukan_live_ranking','inspektur_ajukan_var','inspektur_akhiri_sesi','inspektur_batalkan_live_ranking',
    'inspektur_catat','inspektur_list_var','inspektur_monitor','inspektur_progres_juri','inspektur_ringkasan',
    'inspektur_set_hide_live_ranking','inspektur_terapkan_perbaikan','inspektur_var_detail','inspektur_selesaikan_var',
    'inspektur_buka_perhatian','ip2_ajukan_peninjauan','ip2_putuskan_var','ip_putuskan_keberatan','juri_hasil_final',
    'juri_vote_var','juri_vote_live_ranking','juri_live_ranking_pending','keberatan_status','keberatan_window',
    'live_ranking_sesi_list','mulai_sesi','akhiri_sesi','ubah_mazmur_sesi','operator_var_status','public_live_state',
    'public_pengumuman_state','sekretariat_set_sesi','sekretariat_tukar_peserta','set_branding','set_keberatan_deadline',
    'set_live_ranking_kategori','set_live_ranking_top10','set_pengumuman_state','set_peserta_terlambat','set_sesi_tampil',
    'set_vmix_var_badge','var_berita_acara','var_detail_persepsi','viewer_catatan_peserta','viewer_peserta_list',
    'get_klarifikasi_status','submit_klarifikasi_var','mulai_klarifikasi_var','get_var_aktif'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    IF r.proname = ANY(auth_fns) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    IF r.proname = ANY(anon_fns) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "staff read juri roster" ON public.juri;
CREATE POLICY "staff read juri roster"
ON public.juri
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'panitia'::app_role)
  OR public.has_role(auth.uid(), 'ketua_juri'::app_role)
);