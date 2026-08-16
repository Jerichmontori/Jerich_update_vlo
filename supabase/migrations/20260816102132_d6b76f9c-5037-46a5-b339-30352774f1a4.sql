CREATE OR REPLACE FUNCTION public.hitung_nilai_juri(_peserta uuid, _juri uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  ada_tanda boolean := false;
  nilai_standart_val numeric;
  has_var boolean := false;
  pen numeric := 0;
  ns numeric;
  base_val numeric;
  rasio_v numeric; rasio_pn numeric; rasio_it numeric; rasio_pl numeric;
  nm_aspek text; rasio_induk numeric;
  bobot_induk_v numeric; n_induk int; bobot_aspek numeric;
  band_ct boolean;
  band_count int := 0;
  band_idx int;
  band_frac numeric;
  band_lo numeric; band_hi numeric;
  n_eff numeric;
  n_inti numeric;
  frac_inti numeric;
  guna boolean := true;
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
    clear_text_val := aspek->'clearText';
    FOR ay IN SELECT * FROM jsonb_array_elements(COALESCE(aspek->'aspek','[]'::jsonb)) LOOP
      IF jsonb_array_length(COALESCE(ay->'ditandai','[]'::jsonb)) > 0 THEN
        ada_tanda := true;
      END IF;
      FOR b IN SELECT (value)::text::bool FROM jsonb_array_elements(COALESCE(ay->'ayat','[]'::jsonb)) LOOP
        IF b THEN ada_tanda := true; END IF;
      END LOOP;
    END LOOP;
    IF ada_tanda THEN clear_text_val := 'false'::jsonb; END IF;
  END IF;

  clear_text_false := clear_text_val IS NOT NULL
    AND jsonb_typeof(clear_text_val) = 'boolean'
    AND (clear_text_val)::text = 'false';
  clear_text_true := clear_text_val IS NOT NULL
    AND jsonb_typeof(clear_text_val) = 'boolean'
    AND (clear_text_val)::text = 'true';

  raw := skor + (CASE WHEN has_catatan THEN bonus_ratio * bobot_cat ELSE 0 END);
  raw_max := used_weight + (CASE WHEN has_catatan THEN bobot_cat ELSE 0 END);
  raw_min := 0;
  IF raw_max = raw_min THEN RETURN NULL; END IF;

  n := (raw - raw_min) / (raw_max - raw_min);
  n := GREATEST(0, LEAST(1, n));

  SELECT kategori INTO kat_p FROM public.peserta WHERE id=_peserta;
  SELECT k.batas_bawah, k.nilai_tengah, k.batas_atas, k.nilai_standart, k.gunakan_pita
    INTO bb, tg, ba, nilai_standart_val, guna
  FROM public.kategori AS k
  WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(kat_p,'')))
  ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST
  LIMIT 1;
  IF bb IS NULL THEN bb := 0; tg := 50; ba := 100; guna := true; END IF;
  IF tg IS NULL OR tg <= bb OR tg >= ba THEN tg := (bb + ba) / 2; END IF;

  ns := COALESCE(nilai_standart_val, tg);
  ns := GREATEST(bb, LEAST(ba, ns));
  pen := 0;

  SELECT EXISTS (
    SELECT 1 FROM public.var_clarification_session v WHERE v.peserta_id = _peserta
  ) INTO has_var;

  IF clear_text_true OR clear_text_false THEN
    band_ct := clear_text_true;
    SELECT count(*) INTO band_count
    FROM public.pita_nilai p
    WHERE p.aktif AND p.clear_text = band_ct
      AND lower(trim(p.kategori)) = lower(trim(COALESCE(kat_p,'')));
  ELSE
    band_count := 0;
  END IF;

  IF band_count > 0 AND COALESCE(guna, true) THEN
    -- Pita ditentukan HANYA oleh 4 kriteria induk; catatan juri hanya menggeser
    -- posisi di dalam pita sehingga hasil tidak pernah melompat keluar pita.
    n_inti := GREATEST(0, LEAST(1, skor / used_weight));
    n_eff := n_inti;
    band_idx := LEAST(band_count - 1, GREATEST(0, floor(n_eff * band_count)::int));
    frac_inti := GREATEST(0, LEAST(1, n_eff * band_count - band_idx));

    IF has_catatan THEN
      band_frac := 0.35 * frac_inti + 0.65 * GREATEST(0, LEAST(1, bonus_ratio));
    ELSE
      band_frac := frac_inti;
    END IF;
    band_frac := GREATEST(0, LEAST(1, band_frac));

    SELECT p.batas_bawah, p.batas_atas INTO band_lo, band_hi
    FROM public.pita_nilai p
    WHERE p.aktif AND p.clear_text = band_ct
      AND lower(trim(p.kategori)) = lower(trim(COALESCE(kat_p,'')))
    ORDER BY p.urutan, p.batas_bawah
    OFFSET band_idx LIMIT 1;

    out_val := band_lo + (band_hi - band_lo) * band_frac;

    jit := ((abs(hashtext(_peserta::text || '|' || _juri::text)) % 1801) - 900) / 1000000.0;
    out_val := out_val + jit;
    out_val := GREATEST(band_lo, LEAST(band_hi, out_val));
    RETURN round(out_val, 3);
  END IF;

  IF n <= 0.5 THEN
    t := power(n * 2, 1.15);
    out_val := bb + (tg - bb) * t;
  ELSE
    t := 1 - power((1 - n) * 2, 1.15);
    out_val := tg + (ba - tg) * t;
  END IF;

  IF clear_text_false THEN
    base_val := bb + bonus_ratio * GREATEST(0, ns - bb);
    out_val := LEAST(base_val, ns);
    out_val := GREATEST(bb, out_val);
  ELSIF clear_text_true THEN
    out_val := ns + n * GREATEST(0, ba - ns);
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

CREATE OR REPLACE FUNCTION public.preview_pita_juri(_peserta uuid, _juri uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  bobot_v numeric; bobot_pn numeric; bobot_it numeric; bobot_pl numeric;
  skor numeric := 0; used_weight numeric := 0;
  grade_v numeric; n_inti numeric;
  kat_p text; guna boolean := true;
  aspek jsonb; ay jsonb; b bool;
  clear_text_val jsonb; ada_tanda boolean := false;
  ct_status text := 'belum';
  hasil jsonb := '[]'::jsonb;
  ct boolean;
  cnt int; idx int;
  rowp record;
BEGIN
  SELECT
    max(CASE WHEN lower(nama) LIKE '%vocal%' OR lower(nama) LIKE '%vokal%' OR lower(nama) LIKE '%interpretasi%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%penghayatan%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%intonasi%' OR lower(nama) LIKE '%artikulasi%' THEN bobot END),
    max(CASE WHEN lower(nama) LIKE '%penampilan%' THEN bobot END)
  INTO bobot_v, bobot_pn, bobot_it, bobot_pl
  FROM public.kriteria;

  bobot_v := COALESCE(bobot_v, 25); bobot_pn := COALESCE(bobot_pn, 20);
  bobot_it := COALESCE(bobot_it, 30); bobot_pl := COALESCE(bobot_pl, 25);

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
    ELSIF r.nama LIKE '%penghayatan%' THEN
      skor := skor + public.lookup_nilai(grade_v) * bobot_pn; used_weight := used_weight + bobot_pn;
    ELSIF r.nama LIKE '%intonasi%' OR r.nama LIKE '%artikulasi%' THEN
      skor := skor + public.lookup_nilai(grade_v) * bobot_it; used_weight := used_weight + bobot_it;
    ELSIF r.nama LIKE '%penampilan%' THEN
      skor := skor + public.lookup_nilai(grade_v) * bobot_pl; used_weight := used_weight + bobot_pl;
    END IF;
  END LOOP;

  IF used_weight <= 0 THEN
    RETURN jsonb_build_object('ready', false, 'gunakan', true);
  END IF;

  n_inti := GREATEST(0, LEAST(1, skor / used_weight));

  SELECT kategori INTO kat_p FROM public.peserta WHERE id=_peserta;
  SELECT k.gunakan_pita INTO guna
  FROM public.kategori AS k
  WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(kat_p,'')))
  ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST
  LIMIT 1;

  IF NOT COALESCE(guna, true) THEN
    RETURN jsonb_build_object('ready', true, 'gunakan', false, 'kategori', kat_p, 'n_inti', round(n_inti,4));
  END IF;

  SELECT p.detail INTO aspek FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri AND lower(k.nama) LIKE '%perhatian%' LIMIT 1;
  IF aspek IS NOT NULL THEN
    clear_text_val := aspek->'clearText';
    FOR ay IN SELECT * FROM jsonb_array_elements(COALESCE(aspek->'aspek','[]'::jsonb)) LOOP
      IF jsonb_array_length(COALESCE(ay->'ditandai','[]'::jsonb)) > 0 THEN ada_tanda := true; END IF;
      FOR b IN SELECT (value)::text::bool FROM jsonb_array_elements(COALESCE(ay->'ayat','[]'::jsonb)) LOOP
        IF b THEN ada_tanda := true; END IF;
      END LOOP;
    END LOOP;
    IF ada_tanda THEN clear_text_val := 'false'::jsonb; END IF;
    IF clear_text_val IS NOT NULL AND jsonb_typeof(clear_text_val) = 'boolean' THEN
      ct_status := CASE WHEN (clear_text_val)::text = 'true' THEN 'clear' ELSE 'tidak' END;
    END IF;
  END IF;

  FOREACH ct IN ARRAY ARRAY[true, false] LOOP
    SELECT count(*) INTO cnt
    FROM public.pita_nilai p
    WHERE p.aktif AND p.clear_text = ct
      AND lower(trim(p.kategori)) = lower(trim(COALESCE(kat_p,'')));
    IF cnt > 0 THEN
      idx := LEAST(cnt - 1, GREATEST(0, floor(n_inti * cnt)::int));
      SELECT p.label, p.batas_bawah, p.batas_atas, p.deskripsi, p.urutan
        INTO rowp
      FROM public.pita_nilai p
      WHERE p.aktif AND p.clear_text = ct
        AND lower(trim(p.kategori)) = lower(trim(COALESCE(kat_p,'')))
      ORDER BY p.urutan, p.batas_bawah
      OFFSET idx LIMIT 1;

      hasil := hasil || jsonb_build_array(jsonb_build_object(
        'clear_text', ct,
        'urutan', rowp.urutan,
        'index', idx + 1,
        'total', cnt,
        'label', rowp.label,
        'deskripsi', rowp.deskripsi,
        'batas_bawah', rowp.batas_bawah,
        'batas_atas', rowp.batas_atas
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ready', true,
    'gunakan', true,
    'kategori', kat_p,
    'n_inti', round(n_inti, 4),
    'clear_text_status', ct_status,
    'pita', hasil
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_pita_juri(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_pita_juri(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_pita_juri(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_pita_juri(uuid, uuid) TO service_role;