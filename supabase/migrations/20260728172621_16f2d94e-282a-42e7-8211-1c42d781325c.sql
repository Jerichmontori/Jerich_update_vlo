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
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_var_detail(_peserta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'is_active', (vcs.status <> 'final'),
        'komponen_berbeda', vcs.komponen_berbeda,
        'bacaan', mz.bacaan,
        'created_at', vcs.created_at,
        'finalized_at', vcs.finalized_at
      )
      FROM public.var_clarification_session AS vcs
      LEFT JOIN public.mazmur AS mz ON mz.id = vcs.mazmur_id
      WHERE vcs.peserta_id = _peserta
      ORDER BY (vcs.status <> 'final') DESC, vcs.updated_at DESC, vcs.created_at DESC
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
    'nilai_akhir', (
      SELECT CASE WHEN count(*) > 0 THEN avg(pn.nilai)::numeric ELSE NULL END
      FROM public.penilaian AS pn
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
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_terapkan_perbaikan(_peserta uuid, _catatan text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sesi uuid;
  v_var uuid;
  v_review uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'inspektur'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id INTO v_sesi FROM public.sesi_penilaian
   WHERE peserta_id = _peserta ORDER BY started_at DESC LIMIT 1;

  UPDATE public.var_clarification_session
     SET status = 'final',
         komponen_berbeda = '[]'::jsonb,
         finalized_at = COALESCE(finalized_at, now()),
         updated_at = now()
   WHERE peserta_id = _peserta AND status <> 'final'
   RETURNING id INTO v_var;

  IF v_var IS NULL THEN
    SELECT id INTO v_var
    FROM public.var_clarification_session
    WHERE peserta_id = _peserta
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.var_review(session_id, peserta_id, inspektur_id, catatan, keputusan)
  VALUES (v_sesi, _peserta, v_uid, _catatan, 'diterapkan')
  RETURNING id INTO v_review;

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, metadata)
  VALUES (v_uid, 'inspektur_terapkan_perbaikan', v_sesi, _peserta,
          jsonb_build_object('catatan', _catatan, 'var_session_id', v_var));

  RETURN v_review;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.inspektur_buka_perhatian(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_catat(uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_list_var() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_monitor() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_ringkasan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_selesaikan_var(uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_terapkan_perbaikan(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_var_detail(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.inspektur_buka_perhatian(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspektur_catat(uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspektur_list_var() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspektur_monitor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspektur_ringkasan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspektur_selesaikan_var(uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspektur_terapkan_perbaikan(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspektur_var_detail(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';