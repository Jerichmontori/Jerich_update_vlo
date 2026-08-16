-- 1. Tabel pita nilai
CREATE TABLE IF NOT EXISTS public.pita_nilai (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kategori text NOT NULL,
  clear_text boolean NOT NULL,
  label text NOT NULL,
  batas_bawah numeric NOT NULL,
  batas_atas numeric NOT NULL,
  urutan integer NOT NULL DEFAULT 0,
  deskripsi text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pita_nilai_batas_valid CHECK (batas_atas >= batas_bawah)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pita_nilai TO authenticated;
GRANT ALL ON public.pita_nilai TO service_role;

ALTER TABLE public.pita_nilai ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pita_nilai_select_auth" ON public.pita_nilai;
CREATE POLICY "pita_nilai_select_auth" ON public.pita_nilai
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pita_nilai_admin_all" ON public.pita_nilai;
CREATE POLICY "pita_nilai_admin_all" ON public.pita_nilai
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_pita_nilai_updated_at ON public.pita_nilai;
CREATE TRIGGER trg_pita_nilai_updated_at
  BEFORE UPDATE ON public.pita_nilai
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pita_nilai_kategori ON public.pita_nilai (lower(kategori), clear_text, urutan);

-- 2. Seed sesuai pedoman untuk kategori P/KB
INSERT INTO public.pita_nilai (kategori, clear_text, label, batas_bawah, batas_atas, urutan, deskripsi)
VALUES
  ('P/KB', false, 'Tidak clear text', 81.099, 81.099, 1, 'Nilai tengah untuk peserta yang tidak clear text'),
  ('P/KB', true,  'Clear text - dasar', 81.301, 81.500, 1, 'Clear text tapi interpretasi, artikulasi, intonasi masih biasa'),
  ('P/KB', true,  'Clear text - interpretasi kurang tepat', 81.501, 81.700, 2, 'Clear text, lain-lain baik tapi interpretasi kurang tepat'),
  ('P/KB', true,  'Interpretasi baik, artikulasi biasa', 81.701, 81.800, 3, 'Clear text, interpretasi baik, artikulasi biasa, gestur kurang, monoton tidak ada dinamika dan irama cenderung sama'),
  ('P/KB', true,  'Interpretasi & penghayatan baik', 81.801, 81.900, 4, 'Clear text, interpretasi baik, penghayatan baik, artikulasi baik, intonasi irama masih monoton, kurang gestur ekspresi dan mimik'),
  ('P/KB', true,  'Vokal belum maksimal', 81.901, 81.990, 5, 'Clear text, interpretasi baik, penghayatan baik, intonasi irama baik, vokal belum maksimal/terganggu, gestur ekspresi dan mimik baik, irama & dinamika kurang variatif'),
  ('P/KB', true,  'Memenuhi semua kriteria', 81.991, 81.999, 6, 'Memenuhi semua kriteria, pembeda tinggal rasa/kesan yang tersampaikan ke juri')
ON CONFLICT DO NOTHING;

-- 3. RPC baca pita
CREATE OR REPLACE FUNCTION public.get_pita_nilai(_kategori text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.kategori, p.clear_text, p.urutan), '[]'::jsonb)
  FROM public.pita_nilai p
  WHERE _kategori IS NULL
     OR lower(trim(p.kategori)) = lower(trim(_kategori));
$$;

REVOKE ALL ON FUNCTION public.get_pita_nilai(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pita_nilai(text) TO authenticated;

-- 4. RPC simpan pita (admin)
CREATE OR REPLACE FUNCTION public.admin_set_pita_nilai(_kategori text, _pita jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it jsonb;
  bb numeric; ba numeric;
  kb numeric; kt numeric;
  cnt int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah pita nilai';
  END IF;
  IF _kategori IS NULL OR trim(_kategori) = '' THEN
    RAISE EXCEPTION 'Kategori wajib diisi';
  END IF;

  SELECT k.batas_bawah, k.batas_atas INTO kb, kt
  FROM public.kategori k
  WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(_kategori))
  ORDER BY k.updated_at DESC NULLS LAST LIMIT 1;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_pita, '[]'::jsonb)) LOOP
    bb := (it->>'batas_bawah')::numeric;
    ba := (it->>'batas_atas')::numeric;
    IF bb IS NULL OR ba IS NULL THEN
      RAISE EXCEPTION 'Batas bawah dan batas atas wajib diisi';
    END IF;
    IF ba < bb THEN
      RAISE EXCEPTION 'Batas atas (%) tidak boleh lebih kecil dari batas bawah (%)', ba, bb;
    END IF;
    IF kb IS NOT NULL AND (bb < kb OR ba > kt) THEN
      RAISE EXCEPTION 'Pita % harus berada di dalam rentang kategori %-%', COALESCE(it->>'label','?'), kb, kt;
    END IF;
    cnt := cnt + 1;
  END LOOP;

  DELETE FROM public.pita_nilai p
  WHERE lower(trim(p.kategori)) = lower(trim(_kategori));

  INSERT INTO public.pita_nilai (kategori, clear_text, label, batas_bawah, batas_atas, urutan, deskripsi, aktif)
  SELECT
    trim(_kategori),
    COALESCE((e->>'clear_text')::boolean, false),
    COALESCE(NULLIF(e->>'label',''), 'Pita'),
    (e->>'batas_bawah')::numeric,
    (e->>'batas_atas')::numeric,
    COALESCE((e->>'urutan')::int, 0),
    NULLIF(e->>'deskripsi',''),
    COALESCE((e->>'aktif')::boolean, true)
  FROM jsonb_array_elements(COALESCE(_pita, '[]'::jsonb)) AS e;

  RETURN jsonb_build_object('ok', true, 'kategori', trim(_kategori), 'jumlah', cnt);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_pita_nilai(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_pita_nilai(text, jsonb) TO authenticated;

-- 5. Perhitungan nilai mengikuti pita
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
  band_ct boolean;
  band_count int := 0;
  band_idx int;
  band_frac numeric;
  band_lo numeric; band_hi numeric;
  n_eff numeric;
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

  ns := COALESCE(nilai_standart_val, tg);
  ns := GREATEST(bb, LEAST(ba, ns));
  pen := CASE WHEN has_perhatian THEN LEAST(1.0, penalty_marks / 15.0) ELSE 0 END;

  SELECT EXISTS (
    SELECT 1 FROM public.var_clarification_session v WHERE v.peserta_id = _peserta
  ) INTO has_var;

  -- === Pemetaan pita dinamis (jika dikonfigurasi) ===
  IF clear_text_true OR clear_text_false THEN
    band_ct := clear_text_true;
    SELECT count(*) INTO band_count
    FROM public.pita_nilai p
    WHERE p.aktif AND p.clear_text = band_ct
      AND lower(trim(p.kategori)) = lower(trim(COALESCE(kat_p,'')));
  ELSE
    band_count := 0;
  END IF;

  IF band_count > 0 THEN
    n_eff := GREATEST(0, LEAST(1, n * (1 - pen)));
    band_idx := LEAST(band_count - 1, GREATEST(0, floor(n_eff * band_count)::int));
    band_frac := n_eff * band_count - band_idx;
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

  -- === Perilaku lama (tanpa konfigurasi pita) ===
  IF n <= 0.5 THEN
    t := power(n * 2, 1.15);
    out_val := bb + (tg - bb) * t;
  ELSE
    t := 1 - power((1 - n) * 2, 1.15);
    out_val := tg + (ba - tg) * t;
  END IF;

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
