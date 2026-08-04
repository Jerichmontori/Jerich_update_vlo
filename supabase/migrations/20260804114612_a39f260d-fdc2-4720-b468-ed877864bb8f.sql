CREATE OR REPLACE FUNCTION public.detect_potensi_var(_peserta uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
    -- Parameter wajib sama: Clear Text
    WITH valid_juri AS (
      SELECT ps.juri_id
      FROM public.penilaian_submission ps
      WHERE ps.peserta_id = _peserta
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
  VALUES (auth.uid(), 'var_detected', _peserta, jsonb_build_object('komponen', comps));

  RETURN new_id;
END;
$fn$;