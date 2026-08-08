
INSERT INTO public.system_config(key, value)
VALUES ('live_ranking_kategori', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_live_ranking_kategori(_kategori text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.system_config(key, value)
  VALUES ('live_ranking_kategori', COALESCE(to_jsonb(_kategori), '[]'::jsonb))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN jsonb_build_object('kategori', COALESCE(to_jsonb(_kategori), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_live_ranking_kategori()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value FROM public.system_config WHERE key='live_ranking_kategori'), '[]'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.set_live_ranking_kategori(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_live_ranking_kategori() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_live_ranking_kategori(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_live_ranking_kategori() TO anon, authenticated, service_role;

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
  sesi_list jsonb;
  kat text[];
BEGIN
  SELECT COALESCE(array_agg(t.v), ARRAY[]::text[]) INTO kat
  FROM (SELECT jsonb_array_elements_text(COALESCE((SELECT value FROM public.system_config WHERE key='live_ranking_kategori'), '[]'::jsonb)) AS v) t;

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
      AND (cardinality(kat) = 0 OR COALESCE(p.kategori,'') = ANY(kat))
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
    'sesi_tayang', sesi_list,
    'kategori_tayang', COALESCE(to_jsonb(kat), '[]'::jsonb)
  );
END;
$$;
