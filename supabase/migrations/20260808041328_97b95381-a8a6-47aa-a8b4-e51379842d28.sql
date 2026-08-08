CREATE OR REPLACE FUNCTION public.live_ranking_sesi_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE res jsonb; jtotal bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT count(*) INTO jtotal FROM public.juri WHERE approved AND role='juri' AND aktif_menilai AND NOT is_dummy;

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'sesi_no')::int), '[]'::jsonb) INTO res
  FROM (
    SELECT jsonb_build_object(
      'sesi_no', s.sesi_no,
      'total', s.total,
      'final_count', s.final_count,
      'peserta', s.peserta,
      'status', COALESCE(l.status,'draft'),
      'hidden', COALESCE(l.hidden,false),
      'requested_at', l.requested_at,
      'approved_at', l.approved_at,
      'juri_total', jtotal,
      'setuju_count', (SELECT count(*) FROM public.live_ranking_vote v JOIN public.juri jj ON jj.id = v.juri_id AND jj.aktif_menilai WHERE v.sesi_no = s.sesi_no AND v.setuju),
      'tolak_count', (SELECT count(*) FROM public.live_ranking_vote v JOIN public.juri jj ON jj.id = v.juri_id AND jj.aktif_menilai WHERE v.sesi_no = s.sesi_no AND NOT v.setuju),
      'juri_status', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'juri_id', j.id, 'nama', j.nama,
          'sudah_vote', (v.id IS NOT NULL),
          'setuju', v.setuju
        ) ORDER BY j.nama), '[]'::jsonb)
        FROM public.juri j
        LEFT JOIN public.live_ranking_vote v ON v.juri_id = j.id AND v.sesi_no = s.sesi_no
        WHERE j.approved AND j.role='juri' AND j.aktif_menilai AND NOT j.is_dummy
      )
    ) AS x
    FROM (
      SELECT ((p.nomor_urut - 1) / 10) + 1 AS sesi_no,
             count(*) AS total,
             count(*) FILTER (WHERE public.is_peserta_final(p.id)) AS final_count,
             jsonb_agg(jsonb_build_object('nomor_urut', p.nomor_urut, 'nama', p.nama,
                                          'final', public.is_peserta_final(p.id))
                       ORDER BY p.nomor_urut) AS peserta
      FROM public.peserta p
      GROUP BY ((p.nomor_urut - 1) / 10) + 1
    ) s
    LEFT JOIN public.live_ranking_sesi l ON l.sesi_no = s.sesi_no
  ) t;

  RETURN res;
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
  WITH j AS (SELECT count(*) AS n FROM public.juri WHERE approved AND role='juri' AND aktif_menilai AND NOT is_dummy),
  done AS (
    SELECT ps.peserta_id
    FROM public.penilaian_submission ps
    JOIN public.juri jj ON jj.id = ps.juri_id AND jj.aktif_menilai
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
      AND j.aktif_menilai
      AND j.is_dummy = public.is_peserta_uji(_peserta)
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;