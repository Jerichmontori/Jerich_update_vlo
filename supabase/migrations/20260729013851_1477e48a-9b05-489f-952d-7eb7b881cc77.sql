CREATE OR REPLACE FUNCTION public.hitung_nilai_juri(_peserta uuid, _juri uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  bobot_v numeric := 0; bobot_pn numeric := 0; bobot_it numeric := 0; bobot_pl numeric := 0;
  bobot_cat numeric := 0; bobot_per numeric := 0;
  skor numeric := 0;
  bonus_ratio numeric := 0; bonus_n int := 0;
  penalty_marks int := 0;
  raw numeric; raw_min numeric; raw_max numeric; n numeric;
  bb numeric; tg numeric; ba numeric;
  kat_p text;
  out_val numeric; t numeric; jit numeric;
  aspek jsonb; ay jsonb; b bool; grade_v numeric;
  required_count int;
  filled_count int;
BEGIN
  SELECT count(*) INTO required_count FROM public.kriteria;
  SELECT count(DISTINCT p.kriteria_id) INTO filled_count
  FROM public.penilaian p
  WHERE p.peserta_id = _peserta AND p.juri_id = _juri;

  IF required_count = 0 OR filled_count < required_count THEN
    RETURN NULL;
  END IF;

  SELECT
    max(CASE WHEN lower(nama) LIKE '%vocal%' OR lower(nama) LIKE '%vokal%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%penghayatan%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%intonasi%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%penampilan%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%catatan%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%perhatian%' THEN bobot END)
  INTO bobot_v, bobot_pn, bobot_it, bobot_pl, bobot_cat, bobot_per
  FROM public.kriteria;

  bobot_v := COALESCE(bobot_v, 25); bobot_pn := COALESCE(bobot_pn, 20);
  bobot_it := COALESCE(bobot_it, 30); bobot_pl := COALESCE(bobot_pl, 25);
  bobot_cat := COALESCE(bobot_cat, 10); bobot_per := COALESCE(bobot_per, -10);

  FOR r IN
    SELECT lower(k.nama) AS nama, p.nilai, p.detail
    FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri
      AND (
        lower(k.nama) LIKE '%vocal%' OR lower(k.nama) LIKE '%vokal%' OR
        lower(k.nama) LIKE '%penghayatan%' OR lower(k.nama) LIKE '%intonasi%' OR
        lower(k.nama) LIKE '%penampilan%'
      )
  LOOP
    grade_v := COALESCE((r.detail->>'grade')::numeric, r.nilai/20.0);
    IF r.nama LIKE '%vocal%' OR r.nama LIKE '%vokal%' THEN skor := skor + public.lookup_nilai(grade_v) * bobot_v;
    ELSIF r.nama LIKE '%penghayatan%' THEN skor := skor + public.lookup_nilai(grade_v) * bobot_pn;
    ELSIF r.nama LIKE '%intonasi%' THEN skor := skor + public.lookup_nilai(grade_v) * bobot_it;
    ELSIF r.nama LIKE '%penampilan%' THEN skor := skor + public.lookup_nilai(grade_v) * bobot_pl;
    END IF;
  END LOOP;

  SELECT detail INTO aspek FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri AND lower(k.nama) LIKE '%catatan%' LIMIT 1;
  IF aspek IS NOT NULL THEN
    FOR ay IN SELECT * FROM jsonb_array_elements(COALESCE(aspek->'aspek','[]'::jsonb)) LOOP
      IF COALESCE((ay->>'skipped')::bool, false) = false AND (ay->>'nilai') IS NOT NULL THEN
        bonus_ratio := bonus_ratio + public.lookup_nilai((ay->>'nilai')::numeric);
        bonus_n := bonus_n + 1;
      END IF;
    END LOOP;
    IF bonus_n > 0 THEN bonus_ratio := bonus_ratio / bonus_n; ELSE bonus_ratio := 0; END IF;
  END IF;

  SELECT detail INTO aspek FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri AND lower(k.nama) LIKE '%perhatian%' LIMIT 1;
  IF aspek IS NOT NULL THEN
    IF COALESCE((aspek->>'membacaPerikop')::bool, false) THEN penalty_marks := penalty_marks + 1; END IF;
    FOR ay IN SELECT * FROM jsonb_array_elements(COALESCE(aspek->'aspek','[]'::jsonb)) LOOP
      FOR b IN SELECT (value)::text::bool FROM jsonb_array_elements(COALESCE(ay->'ayat','[]'::jsonb)) LOOP
        IF b THEN penalty_marks := penalty_marks + 1; END IF;
      END LOOP;
    END LOOP;
  END IF;

  raw := skor + bonus_ratio * bobot_cat + LEAST(1.0, penalty_marks / 15.0) * bobot_per;
  raw_max := (bobot_v + bobot_pn + bobot_it + bobot_pl) + bobot_cat;
  raw_min := bobot_per;
  IF raw_max = raw_min THEN RETURN NULL; END IF;

  n := (raw - raw_min) / (raw_max - raw_min);
  n := GREATEST(0, LEAST(1, n));

  SELECT kategori INTO kat_p FROM public.peserta WHERE id=_peserta;
  SELECT k.batas_bawah, k.nilai_tengah, k.batas_atas INTO bb, tg, ba
  FROM public.kategori AS k
  WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(kat_p,'')))
  ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST
  LIMIT 1;
  IF bb IS NULL THEN bb := 0; tg := 50; ba := 100; END IF;
  IF tg IS NULL OR tg <= bb OR tg >= ba THEN tg := (bb + ba) / 2; END IF;

  IF n <= 0.5 THEN
    t := power(n * 2, 1.15);
    out_val := bb + (tg - bb) * t;
  ELSE
    t := 1 - power((1 - n) * 2, 1.15);
    out_val := tg + (ba - tg) * t;
  END IF;

  jit := ((abs(hashtext(_peserta::text || '|' || _juri::text)) % 1801) - 900) / 1000000.0;
  out_val := out_val + jit;
  out_val := GREATEST(bb, LEAST(ba, out_val));

  RETURN round(out_val, 3);
END;
$function$;

CREATE OR REPLACE FUNCTION public.hitung_nilai_akhir(_peserta uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total numeric := 0; cnt int := 0; v numeric;
  jid uuid; bb numeric; ba numeric; kat_p text;
BEGIN
  FOR jid IN SELECT DISTINCT juri_id FROM public.penilaian_submission WHERE peserta_id=_peserta LOOP
    v := public.hitung_nilai_juri(_peserta, jid);
    IF v IS NOT NULL THEN total := total + v; cnt := cnt + 1; END IF;
  END LOOP;
  IF cnt = 0 THEN RETURN NULL; END IF;

  SELECT kategori INTO kat_p FROM public.peserta WHERE id=_peserta;
  SELECT k.batas_bawah, k.batas_atas INTO bb, ba
  FROM public.kategori AS k
  WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(kat_p,'')))
  ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST
  LIMIT 1;
  IF bb IS NULL THEN bb := 0; ba := 100; END IF;

  v := total / cnt;
  v := GREATEST(bb, LEAST(ba, v));
  RETURN round(v, 3);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, asal text, total_skor numeric, rata_rata numeric, jumlah_juri bigint, nilai_akhir numeric, var_status text, juri_total_sum numeric, juri_spread numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH per_juri AS (
    SELECT ps.peserta_id, ps.juri_id, public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) AS nj
    FROM public.penilaian_submission ps
  ),
  valid_juri AS (
    SELECT * FROM per_juri WHERE nj IS NOT NULL
  ),
  agg AS (
    SELECT peserta_id,
           SUM(nj) AS juri_total_sum,
           (COALESCE(MAX(nj),0) - COALESCE(MIN(nj),0)) AS juri_spread,
           COUNT(*)::bigint AS jumlah_juri
    FROM valid_juri
    GROUP BY peserta_id
  )
  SELECT p.id AS peserta_id,
         p.nomor_urut,
         p.nama,
         p.asal,
         COALESCE(a.juri_total_sum, 0)::numeric AS total_skor,
         COALESCE(public.hitung_nilai_akhir(p.id), 0)::numeric AS rata_rata,
         COALESCE(a.jumlah_juri, 0)::bigint AS jumlah_juri,
         public.hitung_nilai_akhir(p.id) AS nilai_akhir,
         (SELECT status FROM public.var_clarification_session vs WHERE vs.peserta_id=p.id AND vs.status <> 'final' LIMIT 1) AS var_status,
         COALESCE(a.juri_total_sum, 0)::numeric AS juri_total_sum,
         COALESCE(a.juri_spread, 0)::numeric AS juri_spread
  FROM public.peserta p
  LEFT JOIN agg a ON a.peserta_id = p.id
  ORDER BY
    public.hitung_nilai_akhir(p.id) DESC NULLS LAST,
    COALESCE(a.juri_total_sum, 0) DESC,
    COALESCE(a.juri_spread, 0) DESC,
    p.nomor_urut ASC;
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_monitor()
RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, kategori text, bacaan text, status text, juri_done bigint, juri_total bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_jtotal bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'inspektur'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO v_jtotal
  FROM public.juri AS j
  WHERE j.approved = true
    AND j.role = 'juri'::app_role;

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
      WHEN COALESCE(sub.n, 0) >= v_jtotal AND v_jtotal > 0 THEN 'Final'
      WHEN sp.id IS NOT NULL AND sp.status = 'active' THEN 'Sedang Dinilai'
      WHEN COALESCE(sub.n, 0) > 0 THEN 'Menunggu Juri'
      ELSE 'Menunggu'
    END AS status,
    COALESCE(sub.n, 0) AS juri_done,
    v_jtotal AS juri_total
  FROM public.peserta AS p
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

CREATE OR REPLACE FUNCTION public.inspektur_ringkasan()
RETURNS TABLE(total_peserta bigint, sudah_tampil bigint, belum_tampil bigint, sedang_tampil bigint, sesi_aktif bigint, sesi_selesai bigint, total_var bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  WITH j AS (SELECT count(*) AS n FROM public.juri WHERE approved AND role='juri'),
  done AS (
    SELECT ps.peserta_id
    FROM public.penilaian_submission ps
    WHERE public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) IS NOT NULL
    GROUP BY ps.peserta_id
    HAVING count(*) >= (SELECT n FROM j)
  )
  SELECT
    (SELECT count(*) FROM public.peserta),
    (SELECT count(*) FROM done),
    (SELECT count(*) FROM public.peserta) - (SELECT count(*) FROM done),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status='active'),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status='active'),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status='selesai'),
    (SELECT count(*) FROM public.var_clarification_session WHERE status <> 'final');
END;
$function$;

DROP TRIGGER IF EXISTS after_submission_detect_var_trigger ON public.penilaian_submission;
CREATE TRIGGER after_submission_detect_var_trigger
AFTER INSERT OR UPDATE ON public.penilaian_submission
FOR EACH ROW EXECUTE FUNCTION public.after_submission_detect_var();

GRANT EXECUTE ON FUNCTION public.hitung_nilai_juri(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hitung_nilai_akhir(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_potensi_var(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_monitor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_ringkasan() TO authenticated;