
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
BEGIN
  SELECT
    max(CASE WHEN lower(nama) LIKE '%vocal%' THEN bobot END),
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
      AND (k.nama IN ('Vocal dan Artikulasi','Penghayatan','Intonasi & Pelafalan','Penampilan'))
  LOOP
    grade_v := COALESCE((r.detail->>'grade')::numeric, r.nilai/20.0);
    IF r.nama LIKE '%vocal%' THEN skor := skor + lookup_nilai(grade_v) * bobot_v;
    ELSIF r.nama LIKE '%penghayatan%' THEN skor := skor + lookup_nilai(grade_v) * bobot_pn;
    ELSIF r.nama LIKE '%intonasi%' THEN skor := skor + lookup_nilai(grade_v) * bobot_it;
    ELSIF r.nama LIKE '%penampilan%' THEN skor := skor + lookup_nilai(grade_v) * bobot_pl;
    END IF;
  END LOOP;

  SELECT detail INTO aspek FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri AND lower(k.nama) LIKE '%catatan%' LIMIT 1;
  IF aspek IS NOT NULL THEN
    FOR ay IN SELECT * FROM jsonb_array_elements(aspek->'aspek') LOOP
      IF COALESCE((ay->>'skipped')::bool, false) = false AND (ay->>'nilai') IS NOT NULL THEN
        bonus_ratio := bonus_ratio + lookup_nilai((ay->>'nilai')::numeric);
        bonus_n := bonus_n + 1;
      END IF;
    END LOOP;
    IF bonus_n > 0 THEN bonus_ratio := bonus_ratio / bonus_n; ELSE bonus_ratio := 0; END IF;
  END IF;

  SELECT detail INTO aspek FROM public.penilaian p JOIN public.kriteria k ON k.id=p.kriteria_id
    WHERE p.peserta_id=_peserta AND p.juri_id=_juri AND lower(k.nama) LIKE '%perhatian%' LIMIT 1;
  IF aspek IS NOT NULL THEN
    IF COALESCE((aspek->>'membacaPerikop')::bool, false) THEN penalty_marks := penalty_marks + 1; END IF;
    FOR ay IN SELECT * FROM jsonb_array_elements(aspek->'aspek') LOOP
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
  -- case-insensitive match; fallback to sane default if not defined
  SELECT batas_bawah, nilai_tengah, batas_atas INTO bb, tg, ba
  FROM public.kategori
  WHERE kategori IS NOT NULL AND lower(trim(kategori)) = lower(trim(COALESCE(kat_p,'')))
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
    v := hitung_nilai_juri(_peserta, jid);
    IF v IS NOT NULL THEN total := total + v; cnt := cnt + 1; END IF;
  END LOOP;
  IF cnt = 0 THEN RETURN NULL; END IF;

  SELECT kategori INTO kat_p FROM public.peserta WHERE id=_peserta;
  SELECT batas_bawah, batas_atas INTO bb, ba
  FROM public.kategori
  WHERE kategori IS NOT NULL AND lower(trim(kategori)) = lower(trim(COALESCE(kat_p,'')))
  LIMIT 1;
  IF bb IS NULL THEN bb := 0; ba := 100; END IF;

  v := total / cnt;
  v := GREATEST(bb, LEAST(ba, v));
  RETURN round(v, 3);
END;
$function$;
