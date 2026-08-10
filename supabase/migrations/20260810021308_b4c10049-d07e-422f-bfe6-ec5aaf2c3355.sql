
-- Helper: sesi peserta (pakai kolom sesi bila diisi, jika tidak hitung per 10 nomor urut)
CREATE OR REPLACE FUNCTION public.sesi_no_of(_nomor integer, _sesi text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(regexp_replace(COALESCE(_sesi,''), '\D', '', 'g'), '')::int,
    ((_nomor - 1) / 10) + 1
  );
$$;

REVOKE ALL ON FUNCTION public.sesi_no_of(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sesi_no_of(integer, text) TO authenticated, anon, service_role;

-- Tukar nomor urut & sesi antara dua peserta (Sekretariat / Admin / Panitia)
CREATE OR REPLACE FUNCTION public.sekretariat_tukar_peserta(_a uuid, _b uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a_nomor int; a_sesi text; b_nomor int; b_sesi text; tmp int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'panitia')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _a = _b THEN RAISE EXCEPTION 'Pilih dua peserta yang berbeda'; END IF;

  SELECT nomor_urut, sesi INTO a_nomor, a_sesi FROM public.peserta WHERE id = _a;
  SELECT nomor_urut, sesi INTO b_nomor, b_sesi FROM public.peserta WHERE id = _b;
  IF a_nomor IS NULL OR b_nomor IS NULL THEN RAISE EXCEPTION 'Peserta tidak ditemukan'; END IF;

  SELECT COALESCE(min(nomor_urut),0) - 1 INTO tmp FROM public.peserta;

  UPDATE public.peserta SET nomor_urut = tmp WHERE id = _a;
  UPDATE public.peserta SET nomor_urut = a_nomor, sesi = a_sesi WHERE id = _b;
  UPDATE public.peserta SET nomor_urut = b_nomor, sesi = b_sesi WHERE id = _a;

  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'tukar_peserta', jsonb_build_object('a', _a, 'b', _b));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sekretariat_tukar_peserta(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sekretariat_tukar_peserta(uuid, uuid) TO authenticated;

-- Atur sesi satu peserta
CREATE OR REPLACE FUNCTION public.sekretariat_set_sesi(_peserta uuid, _sesi integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'panitia')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _sesi IS NULL OR _sesi < 1 THEN RAISE EXCEPTION 'Nomor sesi tidak valid'; END IF;

  UPDATE public.peserta SET sesi = 'Sesi ' || _sesi WHERE id = _peserta;
  IF NOT FOUND THEN RAISE EXCEPTION 'Peserta tidak ditemukan'; END IF;

  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'set_sesi_peserta', _peserta, jsonb_build_object('sesi', _sesi));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sekretariat_set_sesi(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sekretariat_set_sesi(uuid, integer) TO authenticated;

-- viewer_peserta_list: pakai sesi yang diatur Sekretariat
CREATE OR REPLACE FUNCTION public.viewer_peserta_list()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'peserta_id', p.id,
    'nomor_urut', p.nomor_urut,
    'nama', p.nama,
    'asal', p.asal,
    'kategori', p.kategori,
    'terlambat', p.terlambat,
    'sesi_no', public.sesi_no_of(p.nomor_urut, p.sesi),
    'final', public.is_peserta_final(p.id),
    'sedang_tampil', EXISTS (
      SELECT 1 FROM public.sesi_penilaian s
      WHERE s.peserta_id = p.id AND s.status='active'
    ),
    'bacaan', (
      SELECT m.bacaan FROM public.sesi_penilaian s
      LEFT JOIN public.mazmur m ON m.id = s.mazmur_id
      WHERE s.peserta_id = p.id ORDER BY s.started_at DESC LIMIT 1
    )
  ) ORDER BY p.nomor_urut), '[]'::jsonb) INTO res
  FROM public.peserta p;

  RETURN res;
END;
$$;

-- daftar sesi live ranking: kelompok berdasarkan sesi yang diatur Sekretariat
CREATE OR REPLACE FUNCTION public.live_ranking_sesi_list()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      'setuju_count', 0,
      'tolak_count', 0,
      'juri_status', '[]'::jsonb
    ) AS x
    FROM (
      SELECT public.sesi_no_of(p.nomor_urut, p.sesi) AS sesi_no,
             count(*) AS total,
             count(*) FILTER (WHERE public.is_peserta_final(p.id)) AS final_count,
             jsonb_agg(jsonb_build_object('nomor_urut', p.nomor_urut, 'nama', p.nama,
                                          'final', public.is_peserta_final(p.id))
                       ORDER BY p.nomor_urut) AS peserta
      FROM public.peserta p
      GROUP BY public.sesi_no_of(p.nomor_urut, p.sesi)
    ) s
    LEFT JOIN public.live_ranking_sesi l ON l.sesi_no = s.sesi_no
  ) t;

  RETURN res;
END;
$$;

-- pengajuan tayang: cek sesi berdasarkan pengaturan Sekretariat
CREATE OR REPLACE FUNCTION public.inspektur_ajukan_live_ranking(_sesi integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE total int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO total
  FROM public.peserta p WHERE public.sesi_no_of(p.nomor_urut, p.sesi) = _sesi;

  IF total = 0 THEN RAISE EXCEPTION 'Sesi tidak ditemukan'; END IF;

  INSERT INTO public.live_ranking_sesi(sesi_no, status, requested_by, requested_at, approved_at, hidden)
  VALUES (_sesi, 'disetujui', auth.uid(), now(), now(), false)
  ON CONFLICT (sesi_no) DO UPDATE
    SET status='disetujui', requested_by=auth.uid(),
        requested_at=now(), approved_at=now(), hidden=false, updated_at=now();

  DELETE FROM public.live_ranking_vote WHERE sesi_no = _sesi;

  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_tayang', jsonb_build_object('sesi_no', _sesi));

  RETURN jsonb_build_object('sesi_no', _sesi, 'status', 'disetujui');
END;
$$;

-- Live Ranking publik: sesi mengikuti pengaturan Sekretariat, hanya peserta bernilai
CREATE OR REPLACE FUNCTION public.public_live_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ranking_rows jsonb;
  active_rows jsonb;
  sesi_list jsonb;
  kat text[];
  top10 boolean;
BEGIN
  SELECT COALESCE(array_agg(t.v), ARRAY[]::text[]) INTO kat
  FROM (SELECT jsonb_array_elements_text(COALESCE((SELECT value FROM public.system_config WHERE key='live_ranking_kategori'), '[]'::jsonb)) AS v) t;

  SELECT COALESCE((SELECT (value)::text::boolean FROM public.system_config WHERE key='live_ranking_top10'), false) INTO top10;

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
    'kategori_tayang', COALESCE(to_jsonb(kat), '[]'::jsonb),
    'top10_kategori', top10
  );
END;
$$;
