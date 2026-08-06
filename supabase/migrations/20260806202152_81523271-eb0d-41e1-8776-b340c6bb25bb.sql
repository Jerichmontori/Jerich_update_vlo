SET check_function_bodies = off;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator_vmix';

CREATE OR REPLACE FUNCTION public.is_vmix_viewer(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role::text IN ('admin','inspektur','operator_vmix')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_vmix_viewer(uuid) TO authenticated;

-- Monitor peserta
CREATE OR REPLACE FUNCTION public.inspektur_monitor()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, kategori text, bacaan text, status text, juri_done bigint, juri_total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_vmix_viewer(auth.uid()) THEN
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

-- Daftar VAR
CREATE OR REPLACE FUNCTION public.inspektur_list_var()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, kategori text, komponen_berbeda jsonb, status text, bacaan text, juri_berbeda bigint, detected_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_vmix_viewer(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS peserta_id,
    p.nomor_urut,
    p.nama,
    p.kategori,
    vcs.komponen_berbeda,
    vcs.status,
    COALESCE(m.bacaan, '-') AS bacaan,
    (
      SELECT count(DISTINCT pn.juri_id)
      FROM public.penilaian AS pn
      WHERE pn.peserta_id = p.id
    ) AS juri_berbeda,
    vcs.created_at AS detected_at
  FROM public.var_clarification_session AS vcs
  JOIN public.peserta AS p ON p.id = vcs.peserta_id
  LEFT JOIN public.mazmur AS m ON m.id = vcs.mazmur_id
  WHERE vcs.status <> 'final'
  ORDER BY vcs.created_at DESC, p.nomor_urut;
END;
$function$;

-- Progres nilai juri
CREATE OR REPLACE FUNCTION public.inspektur_progres_juri(_peserta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_vmix_viewer(auth.uid()) THEN
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

-- Rincian ayat perbedaan (persepsi)
CREATE OR REPLACE FUNCTION public.var_detail_persepsi(_peserta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  perhatian_kid uuid;
  my_juri uuid;
  privileged boolean;
  res jsonb;
BEGIN
  privileged := public.is_vmix_viewer(auth.uid())
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
$function$;

-- Kontrol layar pengumuman vMix
CREATE OR REPLACE FUNCTION public.set_pengumuman_state(_peserta uuid, _running boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_vmix_viewer(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.pengumuman_state (id, peserta_id, running, updated_at)
  VALUES (1, _peserta, COALESCE(_running,false), now())
  ON CONFLICT (id) DO UPDATE
    SET peserta_id = EXCLUDED.peserta_id,
        running = EXCLUDED.running,
        updated_at = now();
END;
$function$;
