-- ============ SESI LIVE RANKING ============
CREATE TABLE public.live_ranking_sesi (
  sesi_no integer PRIMARY KEY,
  status text NOT NULL DEFAULT 'draft',
  requested_by uuid,
  requested_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_ranking_sesi TO authenticated;
GRANT ALL ON public.live_ranking_sesi TO service_role;
ALTER TABLE public.live_ranking_sesi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read live_ranking_sesi" ON public.live_ranking_sesi
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.live_ranking_vote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesi_no integer NOT NULL REFERENCES public.live_ranking_sesi(sesi_no) ON DELETE CASCADE,
  juri_id uuid NOT NULL,
  setuju boolean NOT NULL,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sesi_no, juri_id)
);

GRANT SELECT ON public.live_ranking_vote TO authenticated;
GRANT ALL ON public.live_ranking_vote TO service_role;
ALTER TABLE public.live_ranking_vote ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read live_ranking_vote" ON public.live_ranking_vote
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_live_ranking_sesi_updated
BEFORE UPDATE ON public.live_ranking_sesi
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ HELPER: peserta final ============
CREATE OR REPLACE FUNCTION public.is_peserta_final(_peserta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.all_juri_submitted(_peserta)
     AND public.hitung_nilai_akhir(_peserta) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.var_clarification_session v
       WHERE v.peserta_id = _peserta AND v.status <> 'final'
     );
$$;

-- ============ DAFTAR SESI (inspektur/admin) ============
CREATE OR REPLACE FUNCTION public.live_ranking_sesi_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- ============ AJUKAN SESI KE LIVE RANKING ============
CREATE OR REPLACE FUNCTION public.inspektur_ajukan_live_ranking(_sesi integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total int; finals int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE public.is_peserta_final(p.id))
    INTO total, finals
  FROM public.peserta p WHERE ((p.nomor_urut - 1) / 10) + 1 = _sesi;

  IF total = 0 THEN RAISE EXCEPTION 'Sesi tidak ditemukan'; END IF;
  IF finals < total THEN
    RAISE EXCEPTION 'Sesi % belum lengkap: % dari % peserta berstatus Final', _sesi, finals, total;
  END IF;

  INSERT INTO public.live_ranking_sesi(sesi_no, status, requested_by, requested_at)
  VALUES (_sesi, 'menunggu_persetujuan', auth.uid(), now())
  ON CONFLICT (sesi_no) DO UPDATE
    SET status='menunggu_persetujuan', requested_by=auth.uid(),
        requested_at=now(), approved_at=NULL, updated_at=now();

  DELETE FROM public.live_ranking_vote WHERE sesi_no = _sesi;

  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_ajukan', jsonb_build_object('sesi_no', _sesi));

  RETURN jsonb_build_object('sesi_no', _sesi, 'status', 'menunggu_persetujuan');
END;
$$;

CREATE OR REPLACE FUNCTION public.inspektur_batalkan_live_ranking(_sesi integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.live_ranking_sesi
     SET status='draft', approved_at=NULL, requested_at=NULL, updated_at=now()
   WHERE sesi_no = _sesi;
  DELETE FROM public.live_ranking_vote WHERE sesi_no = _sesi;
  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_batal', jsonb_build_object('sesi_no', _sesi));
  RETURN jsonb_build_object('sesi_no', _sesi, 'status', 'draft');
END;
$$;

-- ============ JURI: DAFTAR SESI MENUNGGU PERSETUJUAN ============
CREATE OR REPLACE FUNCTION public.juri_live_ranking_pending()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE jid uuid; res jsonb;
BEGIN
  SELECT juri_id INTO jid FROM public.profiles WHERE id = auth.uid();
  IF jid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sesi_no', l.sesi_no,
    'status', l.status,
    'requested_at', l.requested_at,
    'sudah_vote', EXISTS (SELECT 1 FROM public.live_ranking_vote v WHERE v.sesi_no=l.sesi_no AND v.juri_id=jid),
    'peserta', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('nomor_urut', p.nomor_urut, 'nama', p.nama)
                      ORDER BY p.nomor_urut), '[]'::jsonb)
      FROM public.peserta p WHERE ((p.nomor_urut - 1) / 10) + 1 = l.sesi_no
    )
  ) ORDER BY l.sesi_no), '[]'::jsonb) INTO res
  FROM public.live_ranking_sesi l
  WHERE l.status = 'menunggu_persetujuan';

  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION public.juri_vote_live_ranking(_sesi integer, _setuju boolean, _catatan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE jid uuid; jtotal bigint; yes bigint; no bigint; st text;
BEGIN
  SELECT juri_id INTO jid FROM public.profiles WHERE id = auth.uid();
  IF jid IS NULL THEN RAISE EXCEPTION 'Bukan juri'; END IF;

  SELECT status INTO st FROM public.live_ranking_sesi WHERE sesi_no = _sesi;
  IF st IS NULL THEN RAISE EXCEPTION 'Sesi tidak ditemukan'; END IF;
  IF st <> 'menunggu_persetujuan' THEN RAISE EXCEPTION 'Persetujuan tidak dibuka'; END IF;

  INSERT INTO public.live_ranking_vote(sesi_no, juri_id, setuju, catatan)
  VALUES (_sesi, jid, _setuju, _catatan)
  ON CONFLICT (sesi_no, juri_id) DO UPDATE SET setuju = EXCLUDED.setuju, catatan = EXCLUDED.catatan;

  SELECT count(*) INTO jtotal FROM public.juri WHERE approved AND role='juri';
  SELECT count(*) FILTER (WHERE setuju), count(*) FILTER (WHERE NOT setuju)
    INTO yes, no FROM public.live_ranking_vote WHERE sesi_no = _sesi;

  IF no > 0 THEN
    UPDATE public.live_ranking_sesi SET status='ditolak', updated_at=now() WHERE sesi_no=_sesi;
    st := 'ditolak';
  ELSIF yes >= jtotal AND jtotal > 0 THEN
    UPDATE public.live_ranking_sesi SET status='disetujui', approved_at=now(), updated_at=now() WHERE sesi_no=_sesi;
    st := 'disetujui';
  END IF;

  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_vote', jsonb_build_object('sesi_no', _sesi, 'setuju', _setuju, 'status', st));

  RETURN jsonb_build_object('sesi_no', _sesi, 'status', st, 'yes', yes, 'no', no, 'total', jtotal);
END;
$$;

-- ============ JURI: HASIL PENILAIAN SENDIRI (FINAL) ============
CREATE OR REPLACE FUNCTION public.juri_hasil_final()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE jid uuid; res jsonb;
BEGIN
  SELECT juri_id INTO jid FROM public.profiles WHERE id = auth.uid();
  IF jid IS NULL THEN RAISE EXCEPTION 'Bukan juri'; END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'nomor_urut')::int), '[]'::jsonb) INTO res
  FROM (
    SELECT jsonb_build_object(
      'peserta_id', p.id,
      'nomor_urut', p.nomor_urut,
      'nama', p.nama,
      'asal', p.asal,
      'kategori', p.kategori,
      'sesi_no', ((p.nomor_urut - 1) / 10) + 1,
      'nilai_juri', public.hitung_nilai_juri(p.id, jid),
      'penilaian', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'kriteria', k.nama, 'nilai', pn.nilai, 'detail', pn.detail
        ) ORDER BY k.nama), '[]'::jsonb)
        FROM public.penilaian pn
        LEFT JOIN public.kriteria k ON k.id = pn.kriteria_id
        WHERE pn.peserta_id = p.id AND pn.juri_id = jid
      ),
      'masukan', (
        SELECT mj.catatan FROM public.masukan_juri mj
        WHERE mj.peserta_id = p.id AND mj.juri_id = jid LIMIT 1
      )
    ) AS x
    FROM public.peserta p
    WHERE EXISTS (SELECT 1 FROM public.penilaian_submission ps WHERE ps.peserta_id=p.id AND ps.juri_id=jid)
      AND public.is_peserta_final(p.id)
  ) t;

  RETURN res;
END;
$$;

-- ============ VIEWER (ROLE USER) ============
CREATE OR REPLACE FUNCTION public.viewer_peserta_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'peserta_id', p.id,
    'nomor_urut', p.nomor_urut,
    'nama', p.nama,
    'asal', p.asal,
    'kategori', p.kategori,
    'sesi_no', ((p.nomor_urut - 1) / 10) + 1,
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

CREATE OR REPLACE FUNCTION public.viewer_catatan_peserta(_peserta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT public.is_peserta_final(_peserta) THEN
    RAISE EXCEPTION 'Peserta belum selesai dinilai';
  END IF;

  SELECT jsonb_build_object(
    'peserta', (SELECT jsonb_build_object('nomor_urut', p.nomor_urut, 'nama', p.nama, 'asal', p.asal, 'kategori', p.kategori)
                FROM public.peserta p WHERE p.id = _peserta),
    'bacaan', (SELECT m.bacaan FROM public.sesi_penilaian s LEFT JOIN public.mazmur m ON m.id = s.mazmur_id
               WHERE s.peserta_id = _peserta ORDER BY s.started_at DESC LIMIT 1),
    'catatan', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'juri_nama', j.nama, 'catatan', mj.catatan
      ) ORDER BY j.nama), '[]'::jsonb)
      FROM public.masukan_juri mj
      LEFT JOIN public.juri j ON j.id = mj.juri_id
      WHERE mj.peserta_id = _peserta
    )
  ) INTO res;

  RETURN res;
END;
$$;

-- ============ LIVE STATE: HANYA SESI DISETUJUI ============
CREATE OR REPLACE FUNCTION public.public_live_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ranking_rows jsonb;
  active_rows jsonb;
  sesi_list jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(l.sesi_no ORDER BY l.sesi_no), '[]'::jsonb) INTO sesi_list
  FROM public.live_ranking_sesi l WHERE l.status = 'disetujui';

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
      WHERE l.status = 'disetujui' AND l.sesi_no = ((gr.nomor_urut - 1) / 10) + 1
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
$$;

-- ============ GRANTS ============
REVOKE ALL ON FUNCTION public.is_peserta_final(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.live_ranking_sesi_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inspektur_ajukan_live_ranking(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inspektur_batalkan_live_ranking(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.juri_live_ranking_pending() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.juri_vote_live_ranking(integer, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.juri_hasil_final() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.viewer_peserta_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.viewer_catatan_peserta(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_peserta_final(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.live_ranking_sesi_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_ajukan_live_ranking(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_batalkan_live_ranking(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.juri_live_ranking_pending() TO authenticated;
GRANT EXECUTE ON FUNCTION public.juri_vote_live_ranking(integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.juri_hasil_final() TO authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_peserta_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_catatan_peserta(uuid) TO authenticated;