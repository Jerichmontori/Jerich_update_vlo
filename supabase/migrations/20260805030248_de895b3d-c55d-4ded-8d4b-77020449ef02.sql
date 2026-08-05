DO $$
DECLARE
  r record;
  keep_anon text[] := ARRAY['public_live_state','public_pengumuman_state','has_role'];
  trigger_fns text[] := ARRAY['handle_new_user','after_submission_detect_var','prevent_profile_juri_id_change','set_updated_at','block_if_var_active'];
  internal_fns text[] := ARRAY['all_juri_submitted','detect_potensi_var','is_peserta_final','get_var_aktif'];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    IF NOT (r.proname = ANY(keep_anon)) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    END IF;

    IF r.proname = ANY(trigger_fns) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
    END IF;

    IF r.proname = ANY(internal_fns) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
    END IF;
  END LOOP;
END $$;