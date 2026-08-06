CREATE OR REPLACE FUNCTION public.var_detail_persepsi(_peserta uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perhatian_kid uuid;
  my_juri uuid;
  privileged boolean;
  res jsonb;
BEGIN
  privileged := public.has_role(auth.uid(),'admin'::app_role)
             OR public.has_role(auth.uid(),'inspektur'::app_role)
             OR public.has_role(auth.uid(),'ketua_juri'::app_role);

  SELECT juri_id INTO my_juri FROM public.profiles WHERE id = auth.uid();

  IF NOT privileged THEN
    IF my_juri IS NULL THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.penilaian_submission
      WHERE peserta_id = _peserta AND juri_id = my_juri
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT id INTO perhatian_kid FROM public.kriteria
   WHERE lower(nama) LIKE '%perhatian%' LIMIT 1;

  IF perhatian_kid IS NULL THEN
    RETURN jsonb_build_object('juri', '[]'::jsonb);
  END IF;

  WITH sub AS (
    SELECT ps.juri_id, j.nama
    FROM public.penilaian_submission ps
    JOIN public.juri j ON j.id = ps.juri_id
    WHERE ps.peserta_id = _peserta
  ), num AS (
    SELECT s.juri_id, s.nama,
           row_number() OVER (ORDER BY s.nama, s.juri_id) AS idx
    FROM sub s
  )
  SELECT jsonb_build_object(
    'peserta_id', _peserta,
    'juri', COALESCE(jsonb_agg(
      jsonb_build_object(
        'juri_id', n.juri_id,
        'label', CASE WHEN privileged THEN n.nama ELSE 'Juri ' || n.idx END,
        'is_me', (n.juri_id = my_juri),
        'clear_text', COALESCE(p.detail->'clearText', p.detail->'membacaPerikop'),
        'aspek', COALESCE(p.detail->'aspek', '[]'::jsonb)
      ) ORDER BY n.idx
    ), '[]'::jsonb)
  ) INTO res
  FROM num n
  LEFT JOIN public.penilaian p
    ON p.peserta_id = _peserta
   AND p.juri_id = n.juri_id
   AND p.kriteria_id = perhatian_kid;

  RETURN COALESCE(res, jsonb_build_object('juri','[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.var_detail_persepsi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.var_detail_persepsi(uuid) TO authenticated;

-- Perbaikan pemetaan aspek pada deteksi Potensi VAR (0=salah,1=menambah,2=mengurangi)
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
  q_aspek_idx int[] := ARRAY[0, 1, 2];
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
  VALUES (auth.uid(), 'var_terdeteksi', _peserta, jsonb_build_object('komponen', comps));

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_potensi_var(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detect_potensi_var(uuid) TO authenticated;