-- 1) Penanda juri dummy
ALTER TABLE public.juri ADD COLUMN IF NOT EXISTS is_dummy boolean NOT NULL DEFAULT false;

-- 2) Helper: apakah peserta ini peserta uji coba?
CREATE OR REPLACE FUNCTION public.is_peserta_uji(_peserta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT upper(coalesce(kategori,'')) = 'UJICOBA' FROM public.peserta WHERE id = _peserta), false);
$$;

-- 3) Helper: jumlah juri yang berlaku untuk peserta tsb
CREATE OR REPLACE FUNCTION public.juri_pool_count(_peserta uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*) FROM public.juri
   WHERE approved = true AND role = 'juri'::app_role
     AND is_dummy = public.is_peserta_uji(_peserta);
$$;

-- 4) Helper: apakah juri termasuk pool peserta tsb
CREATE OR REPLACE FUNCTION public.juri_in_pool(_juri uuid, _peserta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.juri
     WHERE id = _juri AND approved = true AND role = 'juri'::app_role
       AND is_dummy = public.is_peserta_uji(_peserta)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_peserta_uji(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.juri_pool_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.juri_in_pool(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 5) all_juri_submitted memakai pool
CREATE OR REPLACE FUNCTION public.all_juri_submitted(_peserta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.juri_pool_count(_peserta) > 0
     AND public.juri_pool_count(_peserta) <= (
       SELECT count(*) FROM public.penilaian_submission ps
        WHERE ps.peserta_id = _peserta AND public.juri_in_pool(ps.juri_id, _peserta)
     );
$$;

-- 6) get_submission_progress memakai pool
CREATE OR REPLACE FUNCTION public.get_submission_progress(_peserta uuid)
RETURNS TABLE(done_count bigint, total_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    (SELECT count(DISTINCT ps.juri_id)
       FROM public.penilaian_submission ps
      WHERE ps.peserta_id = _peserta
        AND public.juri_in_pool(ps.juri_id, _peserta))::bigint,
    public.juri_pool_count(_peserta)::bigint;
$$;

-- 7) inspektur_progres_juri hanya menampilkan pool
CREATE OR REPLACE FUNCTION public.inspektur_progres_juri(_peserta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
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
      AND j.is_dummy = public.is_peserta_uji(_peserta)
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

-- 8) get_var_aktif: total juri per peserta
CREATE OR REPLACE FUNCTION public.get_var_aktif()
RETURNS TABLE(session_id uuid, peserta_id uuid, nomor_urut integer, nama text, bacaan text, status text, komponen_berbeda jsonb, submitted_count bigint, juri_total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY
  SELECT s.id, p.id, p.nomor_urut, p.nama, COALESCE(m.bacaan,'-'), s.status, s.komponen_berbeda,
    (SELECT count(DISTINCT r.juri_id) FROM public.var_clarification_response r WHERE r.clarification_id=s.id),
    public.juri_pool_count(p.id)
  FROM public.var_clarification_session s
  JOIN public.peserta p ON p.id=s.peserta_id
  LEFT JOIN public.mazmur m ON m.id=s.mazmur_id
  WHERE s.status <> 'final'
  ORDER BY p.nomor_urut;
END;
$function$;

-- 9) inspektur_monitor: total juri per peserta
CREATE OR REPLACE FUNCTION public.inspektur_monitor()
RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, kategori text, bacaan text, status text, juri_done bigint, juri_total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'inspektur'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS peserta_id,
    p.nomor_urut,
    p.nama,
    p.kategori,
    COALESCE(m.bacaan, '-') AS bacaan,
    CASE
      WHEN vs.id IS NOT NULL AND vs.status = 'perbaikan_perhatian' THEN 'Perbaikan Perhatian'
      WHEN vs.id IS NOT NULL THEN 'Potensi VAR'
      WHEN COALESCE(sub.n, 0) >= jt.n AND jt.n > 0 THEN 'Final'
      WHEN sp.id IS NOT NULL AND sp.status = 'active' THEN 'Sedang Dinilai'
      WHEN COALESCE(sub.n, 0) > 0 THEN 'Menunggu Juri'
      ELSE 'Menunggu'
    END AS status,
    COALESCE(sub.n, 0) AS juri_done,
    jt.n AS juri_total
  FROM public.peserta AS p
  LEFT JOIN LATERAL (SELECT public.juri_pool_count(p.id) AS n) AS jt ON true
  LEFT JOIN LATERAL (
    SELECT s.id, s.status, s.mazmur_id
    FROM public.sesi_penilaian AS s
    WHERE s.peserta_id = p.id
    ORDER BY s.started_at DESC
    LIMIT 1
  ) AS sp ON true
  LEFT JOIN public.mazmur AS m ON m.id = sp.mazmur_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS n
    FROM public.penilaian_submission AS ps
    WHERE ps.peserta_id = p.id
      AND public.juri_in_pool(ps.juri_id, p.id)
      AND public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) IS NOT NULL
  ) AS sub ON true
  LEFT JOIN LATERAL (
    SELECT vcs.id, vcs.status
    FROM public.var_clarification_session AS vcs
    WHERE vcs.peserta_id = p.id
      AND vcs.status <> 'final'
    ORDER BY vcs.created_at DESC
    LIMIT 1
  ) AS vs ON true
  ORDER BY p.nomor_urut;
END;
$function$;

-- 10) detect_potensi_var: pakai pool
CREATE OR REPLACE FUNCTION public.detect_potensi_var(_peserta uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  jtotal bigint;
  submitted bigint;
  perhatian_kid uuid;
  comps jsonb := '[]'::jsonb;
  existing uuid;
  existing_status text;
  new_id uuid;
  q_labels text[] := ARRAY['salah_kata','menambah_kata','mengurangi_kata'];
  q_aspek_idx int[] := ARRAY[0, 1, 2];
  q_idx int;
  aspek_idx int;
  differs boolean;
BEGIN
  jtotal := public.juri_pool_count(_peserta);

  WITH valid AS (
    SELECT ps.juri_id
    FROM public.penilaian_submission ps
    WHERE ps.peserta_id = _peserta
      AND public.juri_in_pool(ps.juri_id, _peserta)
      AND public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) IS NOT NULL
  )
  SELECT count(*) INTO submitted FROM valid;

  IF jtotal = 0 OR submitted < jtotal THEN RETURN NULL; END IF;

  SELECT id INTO perhatian_kid FROM public.kriteria WHERE lower(nama) LIKE '%perhatian%' LIMIT 1;

  IF perhatian_kid IS NOT NULL THEN
    WITH valid_juri AS (
      SELECT ps.juri_id
      FROM public.penilaian_submission ps
      WHERE ps.peserta_id = _peserta
        AND public.juri_in_pool(ps.juri_id, _peserta)
        AND public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) IS NOT NULL
    ),
    per_juri AS (
      SELECT v.juri_id,
             COALESCE(p.detail->'clearText', p.detail->'membacaPerikop', 'null'::jsonb) AS ct
      FROM valid_juri v
      LEFT JOIN public.penilaian p
        ON p.peserta_id = _peserta
       AND p.juri_id = v.juri_id
       AND p.kriteria_id = perhatian_kid
    )
    SELECT count(DISTINCT ct) > 1 INTO differs FROM per_juri;
    IF differs THEN
      comps := comps || to_jsonb('clear_text'::text);
    END IF;

    FOR q_idx IN 1..3 LOOP
      aspek_idx := q_aspek_idx[q_idx];
      WITH valid_juri AS (
        SELECT ps.juri_id
        FROM public.penilaian_submission ps
        WHERE ps.peserta_id = _peserta
          AND public.juri_in_pool(ps.juri_id, _peserta)
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
  VALUES (auth.uid(), 'var_terdeteksi', _peserta, jsonb_build_object('komponen', comps));

  RETURN new_id;
END;
$function$;

-- 11) juri_vote_var: total pakai pool peserta
CREATE OR REPLACE FUNCTION public.juri_vote_var(_session uuid, _setuju boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  IF NOT public.juri_in_pool(v_jid, v_peserta) THEN
    RAISE EXCEPTION 'Anda bukan juri pada peserta ini';
  END IF;

  IF EXISTS (SELECT 1 FROM public.var_clarification_response
             WHERE clarification_id = _session AND juri_id = v_jid AND komponen = 'manual_vote') THEN
    RAISE EXCEPTION 'Anda sudah memberi suara';
  END IF;

  INSERT INTO public.var_clarification_response(clarification_id, juri_id, komponen, keputusan)
  VALUES (_session, v_jid, 'manual_vote', _setuju);

  v_total := public.juri_pool_count(v_peserta);
  SELECT count(*) FILTER (WHERE keputusan), count(*) FILTER (WHERE NOT keputusan), count(*)
    INTO v_yes, v_no, v_total_votes
  FROM public.var_clarification_response
  WHERE clarification_id = _session AND komponen = 'manual_vote';

  v_final_status := v_status;

  IF v_no > 0 THEN
    UPDATE public.var_clarification_session
       SET status = 'ditolak_juri', updated_at = now()
     WHERE id = _session;
    v_final_status := 'ditolak_juri';
    INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
    VALUES (auth.uid(), 'var_manual_ditolak', v_peserta,
            jsonb_build_object('session_id', _session, 'yes', v_yes, 'no', v_no));
  ELSIF v_yes >= v_total AND v_total > 0 THEN
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
$function$;

-- 12) get_klarifikasi_status: juri_total pakai pool
CREATE OR REPLACE FUNCTION public.get_klarifikasi_status(_peserta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  sid uuid; st text; komps jsonb; jid uuid;
  my_resp jsonb; all_resp jsonb;
  submitted_count bigint; jtotal bigint;
  peserta_info jsonb; mazmur_info jsonb;
BEGIN
  SELECT id, status, komponen_berbeda INTO sid, st, komps
    FROM public.var_clarification_session
    WHERE peserta_id=_peserta AND status <> 'final'
    ORDER BY created_at DESC LIMIT 1;
  IF sid IS NULL THEN RETURN NULL; END IF;

  SELECT juri_id INTO jid FROM public.profiles WHERE id=auth.uid();
  SELECT to_jsonb(p) INTO peserta_info FROM public.peserta p WHERE p.id=_peserta;
  SELECT to_jsonb(m) INTO mazmur_info FROM public.mazmur m
    WHERE m.id = (SELECT mazmur_id FROM public.var_clarification_session WHERE id=sid);
  jtotal := public.juri_pool_count(_peserta);
  SELECT count(DISTINCT juri_id) INTO submitted_count FROM public.var_clarification_response WHERE clarification_id=sid;

  IF jid IS NOT NULL THEN
    SELECT jsonb_agg(to_jsonb(r)) INTO my_resp
    FROM public.var_clarification_response r WHERE clarification_id=sid AND juri_id=jid;
  END IF;

  IF has_role(auth.uid(),'admin') OR has_role(auth.uid(),'inspektur') OR has_role(auth.uid(),'ketua_juri') THEN
    SELECT jsonb_agg(jsonb_build_object(
      'juri_id', r.juri_id, 'juri_nama', j.nama, 'komponen', r.komponen,
      'keputusan', r.keputusan, 'catatan', r.catatan, 'submitted_at', r.submitted_at
    )) INTO all_resp
    FROM public.var_clarification_response r LEFT JOIN public.juri j ON j.id=r.juri_id
    WHERE r.clarification_id=sid;
  END IF;

  RETURN jsonb_build_object(
    'session_id', sid, 'status', st, 'komponen_berbeda', komps,
    'peserta', peserta_info, 'mazmur', mazmur_info,
    'my_juri_id', jid, 'my_responses', COALESCE(my_resp,'[]'::jsonb),
    'all_responses', COALESCE(all_resp,'[]'::jsonb),
    'submitted_count', submitted_count, 'juri_total', jtotal
  );
END;
$function$;

-- 13) submit_klarifikasi_var: jtotal pakai pool
CREATE OR REPLACE FUNCTION public.submit_klarifikasi_var(_peserta uuid, _responses jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  sid uuid;
  komps jsonb;
  jid uuid;
  r jsonb;
  komp text;
  submitted_count bigint;
  jtotal bigint;
  all_same boolean;
  final_status text;
BEGIN
  SELECT juri_id INTO jid FROM public.profiles WHERE id = auth.uid();
  IF jid IS NULL THEN RAISE EXCEPTION 'Bukan juri'; END IF;

  SELECT id, komponen_berbeda INTO sid, komps FROM public.var_clarification_session
    WHERE peserta_id=_peserta AND status='klarifikasi_var' LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'Klarifikasi VAR tidak aktif'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.penilaian_submission WHERE peserta_id=_peserta AND juri_id=jid) THEN
    RAISE EXCEPTION 'Anda bukan juri pada peserta ini';
  END IF;
  IF EXISTS (SELECT 1 FROM public.var_clarification_response WHERE clarification_id=sid AND juri_id=jid) THEN
    RAISE EXCEPTION 'Anda sudah mengirim klarifikasi';
  END IF;

  FOR komp IN SELECT jsonb_array_elements_text(komps) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_responses) x
      WHERE x->>'komponen' = komp AND x ? 'keputusan'
    ) THEN
      RAISE EXCEPTION 'Komponen % belum dijawab', komp;
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(_responses) LOOP
    INSERT INTO public.var_clarification_response(clarification_id, juri_id, komponen, keputusan, catatan)
    VALUES (sid, jid, r->>'komponen', (r->>'keputusan')::boolean, r->>'catatan');
  END LOOP;

  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(),'var_juri_submit',_peserta, jsonb_build_object('session_id', sid, 'responses', _responses));

  jtotal := public.juri_pool_count(_peserta);
  SELECT count(DISTINCT juri_id) INTO submitted_count FROM public.var_clarification_response WHERE clarification_id=sid;

  IF submitted_count >= jtotal AND jtotal > 0 THEN
    SELECT NOT EXISTS (
      SELECT komponen FROM public.var_clarification_response
      WHERE clarification_id=sid
      GROUP BY komponen HAVING count(DISTINCT keputusan) > 1
    ) INTO all_same;
    IF all_same THEN
      UPDATE public.var_clarification_session SET status='final', finalized_at=now() WHERE id=sid;
      final_status := 'final';
      INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
      VALUES (auth.uid(),'var_final',_peserta, jsonb_build_object('session_id', sid));
    ELSE
      UPDATE public.var_clarification_session SET status='musyawarah' WHERE id=sid;
      final_status := 'musyawarah';
      INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
      VALUES (auth.uid(),'var_musyawarah',_peserta, jsonb_build_object('session_id', sid));
    END IF;
  ELSE
    final_status := 'klarifikasi_var';
  END IF;

  RETURN jsonb_build_object('session_id', sid, 'status', final_status, 'submitted', submitted_count, 'total', jtotal);
END;
$function$;

-- 14) Pengaman: juri dummy hanya untuk peserta uji coba, dan sebaliknya
CREATE OR REPLACE FUNCTION public.enforce_juri_pool_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_dummy boolean;
BEGIN
  SELECT is_dummy INTO v_dummy FROM public.juri WHERE id = NEW.juri_id;
  IF v_dummy IS NULL THEN RETURN NEW; END IF;
  IF v_dummy <> public.is_peserta_uji(NEW.peserta_id) THEN
    IF v_dummy THEN
      RAISE EXCEPTION 'Juri uji coba hanya boleh menilai peserta uji coba';
    ELSE
      RAISE EXCEPTION 'Peserta uji coba hanya boleh dinilai oleh juri uji coba';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_juri_pool_match() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_juri_pool_penilaian ON public.penilaian;
CREATE TRIGGER trg_juri_pool_penilaian
BEFORE INSERT OR UPDATE ON public.penilaian
FOR EACH ROW EXECUTE FUNCTION public.enforce_juri_pool_match();

DROP TRIGGER IF EXISTS trg_juri_pool_submission ON public.penilaian_submission;
CREATE TRIGGER trg_juri_pool_submission
BEFORE INSERT OR UPDATE ON public.penilaian_submission
FOR EACH ROW EXECUTE FUNCTION public.enforce_juri_pool_match();