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
  used_weight numeric := 0;
  has_catatan boolean := false;
  has_perhatian boolean := false;
  bonus_ratio numeric := 0; bonus_n int := 0; bonus_pts numeric := 0;
  penalty_marks int := 0;
  raw numeric; raw_min numeric; raw_max numeric; n numeric;
  bb numeric; tg numeric; ba numeric;
  kat_p text;
  out_val numeric; t numeric; jit numeric;
  aspek jsonb; ay jsonb; b bool; grade_v numeric;
  filled_count int;
  has_submission boolean;
  clear_text_val jsonb;
  clear_text_false boolean := false;
  clear_text_true boolean := false;
  nilai_standart_val numeric;
  has_var boolean := false;
  pen numeric := 0;
  ns numeric;
  base_val numeric;
  rasio_v numeric; rasio_pn numeric; rasio_it numeric; rasio_pl numeric;
  nm_aspek text; rasio_induk numeric;
  bobot_induk_v numeric; n_induk int; bobot_aspek numeric;
BEGIN
  SELECT count(DISTINCT p.kriteria_id) INTO filled_count
  FROM public.penilaian p
  WHERE p.peserta_id = _peserta AND p.juri_id = _juri;

  SELECT EXISTS (
    SELECT 1 FROM public.penilaian_submission ps
    WHERE ps.peserta_id = _peserta AND ps.juri_id = _juri
  ) INTO has_submission;

  IF filled_count = 0 THEN RETURN NULL; END IF;
  IF NOT has_submission THEN
    IF filled_count < (SELECT count(*) FROM public.kriteria) THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT
    max(CASE WHEN lower(nama) LIKE '%vocal%' OR lower(nama) LIKE '%vokal%' OR lower(nama) LIKE '%interpretasi%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%penghayatan%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%intonasi%' OR lower(nama) LIKE '%artikulasi%' THEN bobot END),
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
        lower(k.nama) LIKE '%interpretasi%' OR
        lower(k.nama) LIKE '%penghayatan%' OR lower(k.nama) LIKE '%intonasi%' OR
        lower(k.nama) LIKE '%artikulasi%' OR lower(k.nama) LIKE '%penampilan%'
      )
  LOOP
    grade_v := COALESCE((r.detail->>'grade')::numeric, r.nilai/20.0);
    IF r.nama LIKE '%vocal%' OR r.nama LIKE '%vokal%' OR r.nama LIKE '%interpretasi%' THEN
      skor := skor + public.lookup_nilai(grade_v) * bobot_v; used_weight := used_weight + bobot_v;
      rasio_v := public.lookup_nilai(grade_v);
    ELSIF r.nama LIKE '%penghayatan%' THEN
      skor := skor + public.lookup_nilai(grade_v) * bobot_pn; used_weight := used_weight + bobot_pn;
      rasio_pn := public.lookup_nilai(grade_v);
    ELSIF r.nama LIKE '%intonasi%' OR r.nama LIKE '%artikulasi%' THEN
      skor := skor + public.lookup_nilai(grade_v) * bobot_it; used_weight := used_weight + bobot_it;
      rasio_it := public.lookup_nilai(grade_v);
    ELSIF r.nama LIKE '%penampilan%' THEN
      skor := skor + public.lookup_nilai(grade_v) * bobot_pl; used_weight := used_weight + bobot_pl;
      rasio_pl := public.lookup_nilai(grade_v);
    END IF;
  END LOOP;

  IF used_weight <= 0 THEN RETURN NULL; END IF;

  SELECT p.detail INTO aspek FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri AND lower(k.nama) LIKE '%catatan%' LIMIT 1;
  IF FOUND THEN has_catatan := true; END IF;
  IF aspek IS NOT NULL THEN
    FOR ay IN SELECT * FROM jsonb_array_elements(COALESCE(aspek->'aspek','[]'::jsonb)) LOOP
      IF COALESCE((ay->>'skipped')::bool, false) = false AND (ay->>'nilai') IS NOT NULL THEN
        nm_aspek := lower(COALESCE(ay->>'nama',''));
        -- pemetaan aspek catatan ke kriteria induk (urutan pengecekan penting)
        IF nm_aspek LIKE '%kesan dari teks%' OR nm_aspek LIKE '%penguasaan teks%' THEN
          rasio_induk := rasio_v; bobot_induk_v := bobot_v; n_induk := 2;
        ELSIF nm_aspek LIKE '%emosi%' OR nm_aspek LIKE '%ekspresi%'
           OR nm_aspek LIKE '%kesesuaian vokal%' OR nm_aspek LIKE '%intonasi dan irama%' THEN
          rasio_induk := rasio_pn; bobot_induk_v := bobot_pn; n_induk := 4;
        ELSIF nm_aspek LIKE '%penggunaan kata%' OR nm_aspek LIKE '%tanda baca%' THEN
          rasio_induk := rasio_it; bobot_induk_v := bobot_it; n_induk := 2;
        ELSIF nm_aspek LIKE '%keserasian%' OR nm_aspek LIKE '%panggung%' THEN
          rasio_induk := rasio_pl; bobot_induk_v := bobot_pl; n_induk := 2;
        ELSE
          rasio_induk := NULL; bobot_induk_v := NULL; n_induk := NULL;
        END IF;

        -- bobot aspek tetap: (bobot induk / bobot catatan juri) / jumlah aspek dalam induk
        IF bobot_induk_v IS NULL OR n_induk IS NULL OR n_induk <= 0 OR bobot_cat = 0 THEN
          bobot_aspek := 1;
        ELSE
          bobot_aspek := (bobot_induk_v / bobot_cat) / n_induk;
        END IF;

        bonus_pts := bonus_pts
          + public.lookup_nilai((ay->>'nilai')::numeric) * COALESCE(rasio_induk, 1) * bobot_aspek;
        bonus_n := bonus_n + 1;
      END IF;
    END LOOP;
    IF bobot_cat <> 0 THEN bonus_ratio := bonus_pts / bobot_cat; ELSE bonus_ratio := 0; END IF;
    bonus_ratio := GREATEST(0, LEAST(1, bonus_ratio));
  END IF;

  aspek := NULL;
  SELECT p.detail INTO aspek FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri AND lower(k.nama) LIKE '%perhatian%' LIMIT 1;
  IF aspek IS NOT NULL THEN
    has_perhatian := true;
    IF COALESCE((aspek->>'membacaPerikop')::bool, false) THEN penalty_marks := penalty_marks + 1; END IF;
    FOR ay IN SELECT * FROM jsonb_array_elements(COALESCE(aspek->'aspek','[]'::jsonb)) LOOP
      FOR b IN SELECT (value)::text::bool FROM jsonb_array_elements(COALESCE(ay->'ayat','[]'::jsonb)) LOOP
        IF b THEN penalty_marks := penalty_marks + 1; END IF;
      END LOOP;
    END LOOP;
    clear_text_val := aspek->'clearText';
  END IF;

  clear_text_false := clear_text_val IS NOT NULL
    AND jsonb_typeof(clear_text_val) = 'boolean'
    AND (clear_text_val)::text = 'false';
  clear_text_true := clear_text_val IS NOT NULL
    AND jsonb_typeof(clear_text_val) = 'boolean'
    AND (clear_text_val)::text = 'true';

  raw := skor
       + (CASE WHEN has_catatan THEN bonus_ratio * bobot_cat ELSE 0 END)
       + (CASE WHEN has_perhatian THEN LEAST(1.0, penalty_marks / 15.0) * bobot_per ELSE 0 END);
  raw_max := used_weight + (CASE WHEN has_catatan THEN bobot_cat ELSE 0 END);
  raw_min := CASE WHEN has_perhatian THEN bobot_per ELSE 0 END;
  IF raw_max = raw_min THEN RETURN NULL; END IF;

  n := (raw - raw_min) / (raw_max - raw_min);
  n := GREATEST(0, LEAST(1, n));

  SELECT kategori INTO kat_p FROM public.peserta WHERE id=_peserta;
  SELECT k.batas_bawah, k.nilai_tengah, k.batas_atas, k.nilai_standart INTO bb, tg, ba, nilai_standart_val
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

  ns := COALESCE(nilai_standart_val, tg);
  ns := GREATEST(bb, LEAST(ba, ns));
  pen := CASE WHEN has_perhatian THEN LEAST(1.0, penalty_marks / 15.0) ELSE 0 END;

  SELECT EXISTS (
    SELECT 1 FROM public.var_clarification_session v WHERE v.peserta_id = _peserta
  ) INTO has_var;

  IF clear_text_false THEN
    base_val := bb + bonus_ratio * GREATEST(0, ns - bb);
    out_val := base_val - (base_val - bb) * pen;
    out_val := LEAST(out_val, ns);
    out_val := GREATEST(bb, out_val);
  ELSIF clear_text_true THEN
    out_val := ns + n * GREATEST(0, ba - ns);
    out_val := GREATEST(bb, LEAST(ba, out_val));
  ELSIF has_var THEN
    out_val := ba - (ba - ns) * pen;
    out_val := GREATEST(bb, LEAST(ba, out_val));
  END IF;

  jit := ((abs(hashtext(_peserta::text || '|' || _juri::text)) % 1801) - 900) / 1000000.0;
  out_val := out_val + jit;
  out_val := GREATEST(bb, LEAST(ba, out_val));

  IF clear_text_false THEN
    out_val := LEAST(out_val, ns);
    out_val := GREATEST(bb, out_val);
  END IF;

  RETURN round(out_val, 3);
END;
$function$;

SELECT public.refresh_nilai_cache();