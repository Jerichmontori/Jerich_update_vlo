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
    WHERE gr.nilai_akhir IS NOT NULL
      AND gr.nilai_akhir > 0
      AND COALESCE(gr.jumlah_juri, 0) > 0
      AND EXISTS (
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