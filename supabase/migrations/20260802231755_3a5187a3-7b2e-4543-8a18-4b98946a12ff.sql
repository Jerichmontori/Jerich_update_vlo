ALTER TABLE public.live_ranking_sesi
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.inspektur_set_hide_live_ranking(_sesi integer, _hidden boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.live_ranking_sesi
     SET hidden = _hidden, updated_at = now()
   WHERE sesi_no = _sesi;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi % belum pernah diajukan', _sesi;
  END IF;
  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), CASE WHEN _hidden THEN 'live_ranking_hide' ELSE 'live_ranking_unhide' END,
          jsonb_build_object('sesi_no', _sesi));
  RETURN jsonb_build_object('sesi_no', _sesi, 'hidden', _hidden);
END;
$function$;

REVOKE ALL ON FUNCTION public.inspektur_set_hide_live_ranking(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_set_hide_live_ranking(integer, boolean) TO authenticated;

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
  SELECT count(*) INTO jtotal FROM public.juri WHERE approved AND role='juri';

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
      'setuju_count', (SELECT count(*) FROM public.live_ranking_vote v WHERE v.sesi_no = s.sesi_no AND v.setuju),
      'tolak_count', (SELECT count(*) FROM public.live_ranking_vote v WHERE v.sesi_no = s.sesi_no AND NOT v.setuju),
      'juri_status', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'juri_id', j.id, 'nama', j.nama,
          'sudah_vote', (v.id IS NOT NULL),
          'setuju', v.setuju
        ) ORDER BY j.nama), '[]'::jsonb)
        FROM public.juri j
        LEFT JOIN public.live_ranking_vote v ON v.juri_id = j.id AND v.sesi_no = s.sesi_no
        WHERE j.approved AND j.role='juri'
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

CREATE OR REPLACE FUNCTION public.public_live_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ranking_rows jsonb;
  active_rows jsonb;
  sesi_list jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(l.sesi_no ORDER BY l.sesi_no), '[]'::jsonb) INTO sesi_list
  FROM public.live_ranking_sesi l WHERE l.status = 'disetujui' AND NOT l.hidden;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY
      COALESCE(r.nilai_akhir,0) DESC,
      COALESCE(r.juri_total_sum,0) DESC,
      COALESCE(r.juri_spread,0) DESC,
      r.nomor_urut ASC), '[]'::jsonb)
  INTO ranking_rows
  FROM (
    SELECT gr.peserta_id, gr.nomor_urut, gr.nama, gr.asal,
           gr.nilai_akhir, gr.jumlah_juri, gr.juri_total_sum, gr.juri_spread,
           p.kategori, ((gr.nomor_urut - 1) / 10) + 1 AS sesi_no
    FROM public.get_ranking() gr
    LEFT JOIN public.peserta p ON p.id = gr.peserta_id
    WHERE EXISTS (
      SELECT 1 FROM public.live_ranking_sesi l
      WHERE l.status = 'disetujui' AND NOT l.hidden
        AND l.sesi_no = ((gr.nomor_urut - 1) / 10) + 1
    )
  ) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'session_id', s.id,
      'peserta_id', p.id,
      'nomor_urut', p.nomor_urut,
      'nama', p.nama,
      'asal', p.asal,
      'kategori', p.kategori,
      'bacaan', m.bacaan,
      'jumlah_ayat', m.jumlah_ayat,
      'started_at', s.started_at
  ) ORDER BY s.started_at DESC), '[]'::jsonb)
  INTO active_rows
  FROM public.sesi_penilaian s
  JOIN public.peserta p ON p.id = s.peserta_id
  LEFT JOIN public.mazmur m ON m.id = s.mazmur_id
  WHERE s.status = 'active';

  RETURN jsonb_build_object(
    'now', now(),
    'active', active_rows,
    'ranking', ranking_rows,
    'sesi_tayang', sesi_list
  );
END;
$function$;