
-- Flag tampil badge VAR di vMix
INSERT INTO public.system_config(key, value)
VALUES ('vmix_var_badge', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_vmix_var_badge(_on boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.system_config(key, value) VALUES ('vmix_var_badge', to_jsonb(_on))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'value', _on);
END;
$$;

REVOKE ALL ON FUNCTION public.set_vmix_var_badge(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_vmix_var_badge(boolean) TO authenticated;

-- Status VAR per peserta untuk halaman operator
CREATE OR REPLACE FUNCTION public.operator_var_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(t.peserta_id::text, t.status), '{}'::jsonb)
  FROM (
    SELECT DISTINCT ON (v.peserta_id) v.peserta_id, v.status
    FROM public.var_clarification_session v
    WHERE v.status <> 'final'
    ORDER BY v.peserta_id, v.created_at DESC
  ) t
  WHERE public.has_role(auth.uid(),'admin')
     OR public.has_role(auth.uid(),'panitia')
     OR public.has_role(auth.uid(),'inspektur')
     OR public.has_role(auth.uid(),'inspektur_var');
$$;

REVOKE ALL ON FUNCTION public.operator_var_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operator_var_status() TO authenticated;

-- Tambahkan var_status ke public_live_state
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
  kat text[];
  top10 boolean;
  var_badge boolean;
BEGIN
  SELECT COALESCE(array_agg(t.v), ARRAY[]::text[]) INTO kat
  FROM (SELECT jsonb_array_elements_text(COALESCE((SELECT value FROM public.system_config WHERE key='live_ranking_kategori'), '[]'::jsonb)) AS v) t;

  SELECT COALESCE((SELECT (value)::text::boolean FROM public.system_config WHERE key='live_ranking_top10'), false) INTO top10;
  SELECT COALESCE((SELECT (value)::text::boolean FROM public.system_config WHERE key='vmix_var_badge'), true) INTO var_badge;

  SELECT COALESCE(jsonb_agg(l.sesi_no ORDER BY l.sesi_no), '[]'::jsonb) INTO sesi_list
  FROM public.live_ranking_sesi l WHERE l.status = 'disetujui' AND NOT l.hidden;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY
      COALESCE(r.nilai_akhir,0) DESC,
      COALESCE(r.juri_total_sum,0) DESC,
      COALESCE(r.juri_spread,0) DESC,
      r.nomor_urut ASC), '[]'::jsonb)
  INTO ranking_rows
  FROM (
    SELECT x.peserta_id, x.nomor_urut, x.nama, x.asal,
           x.nilai_akhir, x.jumlah_juri, x.juri_total_sum, x.juri_spread,
           x.kategori, x.sesi_no
    FROM (
      SELECT gr.peserta_id, gr.nomor_urut, gr.nama, gr.asal,
             gr.nilai_akhir, gr.jumlah_juri, gr.juri_total_sum, gr.juri_spread,
             p.kategori, public.sesi_no_of(gr.nomor_urut, p.sesi) AS sesi_no,
             row_number() OVER (
               PARTITION BY COALESCE(p.kategori,'')
               ORDER BY COALESCE(gr.nilai_akhir,0) DESC,
                        COALESCE(gr.juri_total_sum,0) DESC,
                        COALESCE(gr.juri_spread,0) DESC,
                        gr.nomor_urut ASC
             ) AS rn
      FROM public.get_ranking() gr
      LEFT JOIN public.peserta p ON p.id = gr.peserta_id
      WHERE gr.nilai_akhir IS NOT NULL
        AND gr.nilai_akhir > 0
        AND COALESCE(gr.jumlah_juri, 0) > 0
        AND (cardinality(kat) = 0 OR COALESCE(p.kategori,'') = ANY(kat))
        AND (
          top10 OR EXISTS (
            SELECT 1 FROM public.live_ranking_sesi l
            WHERE l.status = 'disetujui' AND NOT l.hidden
              AND l.sesi_no = public.sesi_no_of(gr.nomor_urut, p.sesi)
          )
        )
    ) x
    WHERE NOT top10 OR x.rn <= 10
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
      'started_at', s.started_at,
      'var_status', CASE WHEN var_badge THEN (
          SELECT v.status FROM public.var_clarification_session v
          WHERE v.peserta_id = p.id AND v.status <> 'final'
          ORDER BY v.created_at DESC LIMIT 1
        ) ELSE NULL END
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
    'kategori_tayang', COALESCE(to_jsonb(kat), '[]'::jsonb),
    'top10_kategori', top10,
    'vmix_var_badge', var_badge
  );
END;
$function$;
