
CREATE OR REPLACE FUNCTION public.public_live_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ranking_rows jsonb;
  active_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY 
      COALESCE(r.nilai_akhir,0) DESC, 
      COALESCE(r.juri_total_sum,0) DESC, 
      COALESCE(r.juri_spread,0) DESC, 
      r.nomor_urut ASC), '[]'::jsonb)
  INTO ranking_rows
  FROM (
    SELECT gr.peserta_id, gr.nomor_urut, gr.nama, gr.asal,
           gr.nilai_akhir, gr.jumlah_juri, gr.juri_total_sum, gr.juri_spread,
           p.kategori
    FROM public.get_ranking() gr
    LEFT JOIN public.peserta p ON p.id = gr.peserta_id
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
    'ranking', ranking_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_live_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_live_state() TO anon, authenticated;
