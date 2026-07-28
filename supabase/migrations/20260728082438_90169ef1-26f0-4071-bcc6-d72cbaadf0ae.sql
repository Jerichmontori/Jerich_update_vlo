CREATE OR REPLACE FUNCTION public.detect_potensi_var(_peserta uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jtotal bigint;
  submitted bigint;
  perhatian_kid uuid;
  comps jsonb := '[]'::jsonb;
  existing uuid;
  new_id uuid;
  q_labels text[] := ARRAY['salah_kata','menambah_kata','mengurangi_kata'];
  -- Index dalam JSON aspek (aspek = PERHATIAN_ASPEK.slice(1)):
  --   0 = Salah kata (Q2), 2 = Menambah kata (Q4), 3 = Mengurangi kata (Q5)
  q_aspek_idx int[] := ARRAY[0, 2, 3];
  q_idx int;
  aspek_idx int;
  differs boolean;
BEGIN
  SELECT count(*) INTO jtotal FROM public.juri WHERE approved = true AND role = 'juri';
  SELECT count(*) INTO submitted FROM public.penilaian_submission WHERE peserta_id = _peserta;
  IF jtotal = 0 OR submitted < jtotal THEN RETURN NULL; END IF;

  SELECT id INTO perhatian_kid FROM public.kriteria WHERE lower(nama) LIKE '%perhatian%' LIMIT 1;

  IF perhatian_kid IS NOT NULL THEN
    FOR q_idx IN 1..3 LOOP
      aspek_idx := q_aspek_idx[q_idx];
      WITH per_juri AS (
        SELECT juri_id,
               (SELECT jsonb_agg(x ORDER BY ord)
                FROM (
                  SELECT ord, (x)::text AS x
                  FROM jsonb_array_elements(coalesce(detail->'aspek'->aspek_idx->'ditandai','[]'::jsonb)) WITH ORDINALITY AS t(x, ord)
                ) s) AS marks
        FROM public.penilaian
        WHERE peserta_id = _peserta AND kriteria_id = perhatian_kid
      )
      SELECT count(DISTINCT marks) > 1 INTO differs FROM per_juri;
      IF differs THEN
        comps := comps || to_jsonb(q_labels[q_idx]);
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(comps) = 0 THEN
    -- Tidak ada perbedaan. Jika sebelumnya ada sesi VAR aktif, biarkan (jangan ubah state);
    -- namun jika belum ada, jangan buat baru.
    RETURN NULL;
  END IF;

  SELECT id INTO existing FROM public.var_clarification_session
    WHERE peserta_id = _peserta AND status <> 'final' LIMIT 1;
  IF existing IS NOT NULL THEN
    UPDATE public.var_clarification_session
      SET komponen_berbeda = comps,
          mazmur_id = (SELECT mazmur_id FROM public.penilaian WHERE peserta_id = _peserta LIMIT 1)
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
$function$;

-- Jalankan ulang deteksi untuk semua peserta yang jurinya sudah lengkap mengirim
DO $$
DECLARE
  jtotal bigint;
  r record;
BEGIN
  SELECT count(*) INTO jtotal FROM public.juri WHERE approved = true AND role = 'juri';
  IF jtotal = 0 THEN RETURN; END IF;
  FOR r IN
    SELECT peserta_id
    FROM public.penilaian_submission
    GROUP BY peserta_id
    HAVING count(*) >= jtotal
  LOOP
    PERFORM public.detect_potensi_var(r.peserta_id);
  END LOOP;
END $$;