DO $$
DECLARE
  r record;
  app_fns text[] := ARRAY[
    'admin_list_juri','admin_list_penilaian','admin_reset_all_penilaian',
    'akhiri_sesi','get_klarifikasi_status','get_ranking','get_submission_progress',
    'get_var_manual_pending','hitung_nilai_akhir','hitung_nilai_juri',
    'inspektur_ajukan_live_ranking','inspektur_ajukan_var','inspektur_akhiri_sesi',
    'inspektur_batalkan_live_ranking','inspektur_buka_perhatian','inspektur_catat',
    'inspektur_list_var','inspektur_monitor','inspektur_progres_juri','inspektur_ringkasan',
    'inspektur_selesaikan_var','inspektur_set_hide_live_ranking','inspektur_terapkan_perbaikan',
    'inspektur_var_detail','juri_hasil_final','juri_live_ranking_pending',
    'juri_vote_live_ranking','juri_vote_var','live_ranking_sesi_list',
    'mulai_klarifikasi_var','mulai_sesi','set_pengumuman_state','submit_klarifikasi_var',
    'ubah_mazmur_sesi','viewer_catatan_peserta','viewer_peserta_list',
    'public_live_state','public_pengumuman_state','has_role','lookup_nilai'
  ];
  anon_fns text[] := ARRAY['public_live_state','public_pengumuman_state','has_role'];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);

    IF r.proname = ANY(app_fns) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;

    IF r.proname = ANY(anon_fns) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
    END IF;
  END LOOP;
END $$;