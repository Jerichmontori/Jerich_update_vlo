CREATE OR REPLACE FUNCTION public.inspektur_monitor()
RETURNS TABLE(
  peserta_id uuid,
  nomor_urut integer,
  nama text,
  kategori text,
  bacaan text,
  status text,
  juri_done bigint,
  juri_total bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      WHEN sp.id IS NOT NULL AND sp.status = 'active' AND COALESCE(sub.n, 0) < v_jtotal THEN 'Sedang Dinilai'
      WHEN sp.id IS NOT NULL AND sp.status = 'active' AND COALESCE(sub.n, 0) >= v_jtotal THEN 'Menunggu Juri'
      WHEN COALESCE(sub.n, 0) >= v_jtotal AND v_jtotal > 0 THEN 'Final'
      WHEN COALESCE(sub.n, 0) > 0 THEN 'Sedang Dinilai'
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
$$;

CREATE OR REPLACE FUNCTION public.inspektur_list_var()
RETURNS TABLE(
  peserta_id uuid,
  nomor_urut integer,
  nama text,
  kategori text,
  komponen_berbeda jsonb,
  status text,
  bacaan text,
  juri_berbeda bigint,
  detected_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.inspektur_var_detail(_peserta uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'inspektur'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'peserta', (
      SELECT to_jsonb(p)
      FROM public.peserta AS p
      WHERE p.id = _peserta
    ),
    'var_session', (
      SELECT jsonb_build_object(
        'id', vcs.id,
        'status', vcs.status,
        'komponen_berbeda', vcs.komponen_berbeda,
        'bacaan', mz.bacaan,
        'created_at', vcs.created_at
      )
      FROM public.var_clarification_session AS vcs
      LEFT JOIN public.mazmur AS mz ON mz.id = vcs.mazmur_id
      WHERE vcs.peserta_id = _peserta
        AND vcs.status <> 'final'
      ORDER BY vcs.created_at DESC
      LIMIT 1
    ),
    'penilaian', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'juri_id', pn.juri_id,
        'juri_nama', j.nama,
        'kriteria_id', pn.kriteria_id,
        'kriteria_nama', k.nama,
        'kriteria', k.nama,
        'nilai', pn.nilai,
        'mazmur_id', pn.mazmur_id,
        'bacaan', m.bacaan,
        'detail', pn.detail,
        'created_at', pn.created_at
      ) ORDER BY j.nama, k.nama), '[]'::jsonb)
      FROM public.penilaian AS pn
      LEFT JOIN public.juri AS j ON j.id = pn.juri_id
      LEFT JOIN public.kriteria AS k ON k.id = pn.kriteria_id
      LEFT JOIN public.mazmur AS m ON m.id = pn.mazmur_id
      WHERE pn.peserta_id = _peserta
    ),
    'nilai', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'juri_id', pn.juri_id,
        'juri_nama', j.nama,
        'kriteria_id', pn.kriteria_id,
        'kriteria_nama', k.nama,
        'kriteria', k.nama,
        'nilai', pn.nilai,
        'mazmur_id', pn.mazmur_id,
        'bacaan', m.bacaan,
        'detail', pn.detail,
        'created_at', pn.created_at
      ) ORDER BY j.nama, k.nama), '[]'::jsonb)
      FROM public.penilaian AS pn
      LEFT JOIN public.juri AS j ON j.id = pn.juri_id
      LEFT JOIN public.kriteria AS k ON k.id = pn.kriteria_id
      LEFT JOIN public.mazmur AS m ON m.id = pn.mazmur_id
      WHERE pn.peserta_id = _peserta
    ),
    'catatan', (
      SELECT COALESCE(jsonb_agg(to_jsonb(vr) ORDER BY vr.created_at DESC), '[]'::jsonb)
      FROM public.var_review AS vr
      WHERE vr.peserta_id = _peserta
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inspektur_monitor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_list_var() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_var_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_buka_perhatian(uuid, text) TO authenticated;