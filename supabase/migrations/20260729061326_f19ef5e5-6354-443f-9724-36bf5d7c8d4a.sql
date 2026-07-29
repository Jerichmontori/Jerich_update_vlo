
-- 1) Progres juri per peserta (untuk halaman Inspektur)
CREATE OR REPLACE FUNCTION public.inspektur_progres_juri(_peserta uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur'::app_role) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_agg(row_data ORDER BY (row_data->>'juri_nama'))
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'juri_id', j.id,
      'juri_nama', j.nama,
      'sudah_kirim', (ps.id IS NOT NULL),
      'submitted_at', ps.created_at,
      'nilai_juri', public.hitung_nilai_juri(_peserta, j.id),
      'penilaian', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'kriteria_id', pn.kriteria_id,
          'kriteria_nama', k.nama,
          'nilai', pn.nilai,
          'detail', pn.detail
        ) ORDER BY k.nama)
        FROM public.penilaian pn
        LEFT JOIN public.kriteria k ON k.id = pn.kriteria_id
        WHERE pn.peserta_id = _peserta AND pn.juri_id = j.id
      ), '[]'::jsonb)
    ) AS row_data
    FROM public.juri j
    LEFT JOIN public.penilaian_submission ps
      ON ps.peserta_id = _peserta AND ps.juri_id = j.id
    WHERE j.approved = true AND j.role = 'juri'::app_role
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.inspektur_progres_juri(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_progres_juri(uuid) TO authenticated;

-- 2) Inspektur mengakhiri sesi + menetapkan Final
CREATE OR REPLACE FUNCTION public.inspektur_akhiri_sesi(_peserta uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sesi uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur'::app_role) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id INTO v_sesi
  FROM public.sesi_penilaian
  WHERE peserta_id = _peserta AND status = 'active'
  ORDER BY started_at DESC LIMIT 1;

  IF v_sesi IS NOT NULL THEN
    UPDATE public.sesi_penilaian SET status='selesai', ended_at=now() WHERE id = v_sesi;
  END IF;

  -- Finalkan semua VAR aktif untuk peserta (menaikkan status peserta jadi Final)
  UPDATE public.var_clarification_session
     SET status='final', finalized_at=now(), updated_at=now()
   WHERE peserta_id = _peserta AND status <> 'final';

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, metadata)
  VALUES (auth.uid(), 'inspektur_akhiri_sesi', v_sesi, _peserta,
          jsonb_build_object('finalized', true));
END;
$$;

REVOKE ALL ON FUNCTION public.inspektur_akhiri_sesi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_akhiri_sesi(uuid) TO authenticated;

-- 3) Inspektur mengajukan VAR manual — hanya jika sesi aktif
CREATE OR REPLACE FUNCTION public.inspektur_ajukan_var(_peserta uuid, _alasan text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sesi uuid;
  v_new uuid;
  v_existing uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur'::app_role) OR public.has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _alasan IS NULL OR btrim(_alasan) = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi';
  END IF;

  SELECT id INTO v_sesi FROM public.sesi_penilaian
   WHERE peserta_id = _peserta AND status = 'active'
   ORDER BY started_at DESC LIMIT 1;
  IF v_sesi IS NULL THEN
    RAISE EXCEPTION 'Sesi penilaian tidak aktif — tidak dapat mengajukan VAR';
  END IF;

  -- Cegah pengajuan ganda saat masih menunggu persetujuan
  SELECT id INTO v_existing FROM public.var_clarification_session
   WHERE peserta_id = _peserta AND status IN ('menunggu_persetujuan_juri','disetujui_juri')
   ORDER BY created_at DESC LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Masih ada pengajuan VAR aktif untuk peserta ini';
  END IF;

  INSERT INTO public.var_clarification_session(peserta_id, mazmur_id, status, komponen_berbeda, started_by, started_at)
  VALUES (
    _peserta,
    (SELECT mazmur_id FROM public.sesi_penilaian WHERE id = v_sesi),
    'menunggu_persetujuan_juri',
    jsonb_build_array('manual'),
    auth.uid(),
    now()
  )
  RETURNING id INTO v_new;

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, metadata)
  VALUES (auth.uid(), 'inspektur_ajukan_var', v_sesi, _peserta,
          jsonb_build_object('alasan', _alasan, 'var_session_id', v_new));

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.inspektur_ajukan_var(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_ajukan_var(uuid, text) TO authenticated;

-- 4) Juri memberi suara persetujuan VAR
CREATE OR REPLACE FUNCTION public.juri_vote_var(_session uuid, _setuju boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jid uuid;
  v_peserta uuid;
  v_status text;
  v_total bigint;
  v_yes bigint;
  v_no bigint;
  v_total_votes bigint;
  v_final_status text;
BEGIN
  SELECT juri_id INTO v_jid FROM public.profiles WHERE id = auth.uid();
  IF v_jid IS NULL THEN RAISE EXCEPTION 'Bukan juri'; END IF;

  SELECT peserta_id, status INTO v_peserta, v_status
    FROM public.var_clarification_session WHERE id = _session;
  IF v_peserta IS NULL THEN RAISE EXCEPTION 'Sesi VAR tidak ditemukan'; END IF;
  IF v_status <> 'menunggu_persetujuan_juri' THEN
    RAISE EXCEPTION 'Persetujuan tidak lagi dibuka';
  END IF;

  -- Setiap juri hanya boleh 1 vote (komponen='manual_vote')
  IF EXISTS (SELECT 1 FROM public.var_clarification_response
             WHERE clarification_id = _session AND juri_id = v_jid AND komponen = 'manual_vote') THEN
    RAISE EXCEPTION 'Anda sudah memberi suara';
  END IF;

  INSERT INTO public.var_clarification_response(clarification_id, juri_id, komponen, keputusan)
  VALUES (_session, v_jid, 'manual_vote', _setuju);

  SELECT count(*) INTO v_total FROM public.juri WHERE approved AND role = 'juri';
  SELECT count(*) FILTER (WHERE keputusan), count(*) FILTER (WHERE NOT keputusan), count(*)
    INTO v_yes, v_no, v_total_votes
  FROM public.var_clarification_response
  WHERE clarification_id = _session AND komponen = 'manual_vote';

  v_final_status := v_status;

  IF v_no > 0 THEN
    -- Ada yang menolak → VAR ditolak
    UPDATE public.var_clarification_session
       SET status = 'ditolak_juri', updated_at = now()
     WHERE id = _session;
    v_final_status := 'ditolak_juri';
    INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
    VALUES (auth.uid(), 'var_manual_ditolak', v_peserta,
            jsonb_build_object('session_id', _session, 'yes', v_yes, 'no', v_no));
  ELSIF v_yes >= v_total AND v_total > 0 THEN
    -- Semua setuju → buka kunci form juri (hapus submission), pertahankan penilaian
    UPDATE public.var_clarification_session
       SET status = 'disetujui_juri', updated_at = now()
     WHERE id = _session;
    DELETE FROM public.penilaian_submission WHERE peserta_id = v_peserta;
    v_final_status := 'disetujui_juri';
    INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
    VALUES (auth.uid(), 'var_manual_disetujui', v_peserta,
            jsonb_build_object('session_id', _session));
  END IF;

  RETURN jsonb_build_object('status', v_final_status, 'yes', v_yes, 'no', v_no, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.juri_vote_var(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.juri_vote_var(uuid, boolean) TO authenticated;

-- 5) Ambil VAR manual yang menunggu persetujuan untuk juri saat ini
CREATE OR REPLACE FUNCTION public.get_var_manual_pending()
RETURNS TABLE(session_id uuid, peserta_id uuid, peserta_nama text, nomor_urut integer, alasan text, sudah_vote boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jid uuid;
BEGIN
  SELECT juri_id INTO v_jid FROM public.profiles WHERE id = auth.uid();
  IF v_jid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    vcs.id AS session_id,
    p.id AS peserta_id,
    p.nama AS peserta_nama,
    p.nomor_urut,
    COALESCE((
      SELECT (metadata->>'alasan')::text
      FROM public.operator_audit_log
      WHERE action = 'inspektur_ajukan_var'
        AND (metadata->>'var_session_id') = vcs.id::text
      ORDER BY created_at DESC LIMIT 1
    ), '') AS alasan,
    EXISTS (
      SELECT 1 FROM public.var_clarification_response r
      WHERE r.clarification_id = vcs.id AND r.juri_id = v_jid AND r.komponen = 'manual_vote'
    ) AS sudah_vote
  FROM public.var_clarification_session vcs
  JOIN public.peserta p ON p.id = vcs.peserta_id
  WHERE vcs.status = 'menunggu_persetujuan_juri'
  ORDER BY vcs.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_var_manual_pending() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_var_manual_pending() TO authenticated;

-- 6) Pastikan detect_potensi_var tidak menimpa status VAR manual
CREATE OR REPLACE FUNCTION public.detect_potensi_var(_peserta uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jtotal bigint;
  submitted bigint;
  perhatian_kid uuid;
  comps jsonb := '[]'::jsonb;
  existing uuid;
  existing_status text;
  new_id uuid;
  q_labels text[] := ARRAY['salah_kata','menambah_kata','mengurangi_kata'];
  q_aspek_idx int[] := ARRAY[0, 2, 3];
  q_idx int;
  aspek_idx int;
  differs boolean;
BEGIN
  SELECT count(*) INTO jtotal FROM public.juri WHERE approved = true AND role = 'juri';

  WITH valid AS (
    SELECT ps.juri_id
    FROM public.penilaian_submission ps
    WHERE ps.peserta_id = _peserta
      AND public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) IS NOT NULL
  )
  SELECT count(*) INTO submitted FROM valid;

  IF jtotal = 0 OR submitted < jtotal THEN RETURN NULL; END IF;

  SELECT id INTO perhatian_kid FROM public.kriteria WHERE lower(nama) LIKE '%perhatian%' LIMIT 1;

  IF perhatian_kid IS NOT NULL THEN
    FOR q_idx IN 1..3 LOOP
      aspek_idx := q_aspek_idx[q_idx];
      WITH valid_juri AS (
        SELECT ps.juri_id
        FROM public.penilaian_submission ps
        WHERE ps.peserta_id = _peserta
          AND public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) IS NOT NULL
      ),
      per_juri AS (
        SELECT v.juri_id,
               COALESCE(
                 (SELECT jsonb_agg(x ORDER BY ord)
                  FROM (
                    SELECT ord, (x)::text AS x
                    FROM jsonb_array_elements(coalesce(p.detail->'aspek'->aspek_idx->'ditandai','[]'::jsonb)) WITH ORDINALITY AS t(x, ord)
                  ) s),
                 '[]'::jsonb
               ) AS marks
        FROM valid_juri v
        LEFT JOIN public.penilaian p
          ON p.peserta_id = _peserta
         AND p.juri_id = v.juri_id
         AND p.kriteria_id = perhatian_kid
      )
      SELECT count(DISTINCT marks) > 1 INTO differs FROM per_juri;
      IF differs THEN
        comps := comps || to_jsonb(q_labels[q_idx]);
      END IF;
    END LOOP;
  END IF;

  SELECT id, status INTO existing, existing_status FROM public.var_clarification_session
    WHERE peserta_id = _peserta AND status <> 'final'
    ORDER BY created_at DESC LIMIT 1;

  -- Jangan sentuh sesi VAR manual (menunggu/disetujui/ditolak juri)
  IF existing IS NOT NULL AND existing_status IN ('menunggu_persetujuan_juri','disetujui_juri','ditolak_juri') THEN
    RETURN existing;
  END IF;

  IF jsonb_array_length(comps) = 0 THEN
    IF existing IS NOT NULL THEN
      UPDATE public.var_clarification_session
        SET status = 'final',
            komponen_berbeda = '[]'::jsonb,
            finalized_at = now(),
            updated_at = now()
        WHERE id = existing;
      INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
      VALUES (auth.uid(), 'var_auto_final', _peserta,
              jsonb_build_object('previous_status', existing_status));
      RETURN existing;
    END IF;
    RETURN NULL;
  END IF;

  IF existing IS NOT NULL THEN
    UPDATE public.var_clarification_session
      SET status = CASE WHEN existing_status = 'perbaikan_perhatian' THEN 'perbaikan_perhatian' ELSE 'potensi_var' END,
          komponen_berbeda = comps,
          mazmur_id = (SELECT mazmur_id FROM public.penilaian WHERE peserta_id = _peserta LIMIT 1),
          updated_at = now()
      WHERE id = existing;
    RETURN existing;
  END IF;

  INSERT INTO public.var_clarification_session(peserta_id, mazmur_id, status, komponen_berbeda)
  VALUES (_peserta, (SELECT mazmur_id FROM public.penilaian WHERE peserta_id = _peserta LIMIT 1), 'potensi_var', comps)
  RETURNING id INTO new_id;

  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'var_detected', _peserta, jsonb_build_object('komponen', comps));

  RETURN new_id;
END;
$$;
