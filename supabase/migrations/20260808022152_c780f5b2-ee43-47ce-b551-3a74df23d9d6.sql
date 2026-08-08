CREATE OR REPLACE FUNCTION public.inspektur_ajukan_live_ranking(_sesi integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO total
  FROM public.peserta p WHERE ((p.nomor_urut - 1) / 10) + 1 = _sesi;

  IF total = 0 THEN RAISE EXCEPTION 'Sesi tidak ditemukan'; END IF;

  -- Langsung tayang: tidak lagi menunggu persetujuan seluruh juri.
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

REVOKE ALL ON FUNCTION public.inspektur_ajukan_live_ranking(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_ajukan_live_ranking(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.juri_vote_live_ranking(_sesi integer, _setuju boolean, _catatan text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE jid uuid; jtotal bigint; yes bigint; no bigint; st text;
BEGIN
  SELECT juri_id INTO jid FROM public.profiles WHERE id = auth.uid();
  IF jid IS NULL THEN RAISE EXCEPTION 'Bukan juri'; END IF;

  SELECT status INTO st FROM public.live_ranking_sesi WHERE sesi_no = _sesi;
  IF st IS NULL THEN RAISE EXCEPTION 'Sesi tidak ditemukan'; END IF;
  IF st NOT IN ('menunggu_persetujuan','disetujui') THEN RAISE EXCEPTION 'Persetujuan tidak dibuka'; END IF;

  INSERT INTO public.live_ranking_vote(sesi_no, juri_id, setuju, catatan)
  VALUES (_sesi, jid, _setuju, _catatan)
  ON CONFLICT (sesi_no, juri_id) DO UPDATE SET setuju = EXCLUDED.setuju, catatan = EXCLUDED.catatan;

  SELECT count(*) INTO jtotal FROM public.juri WHERE approved AND role='juri';
  SELECT count(*) FILTER (WHERE setuju), count(*) FILTER (WHERE NOT setuju)
    INTO yes, no FROM public.live_ranking_vote WHERE sesi_no = _sesi;

  -- Catatan: suara juri kini hanya bersifat masukan; tidak mengubah status tayang.
  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_vote', jsonb_build_object('sesi_no', _sesi, 'setuju', _setuju, 'status', st));

  RETURN jsonb_build_object('sesi_no', _sesi, 'status', st, 'yes', yes, 'no', no, 'total', jtotal);
END;
$$;

REVOKE ALL ON FUNCTION public.juri_vote_live_ranking(integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.juri_vote_live_ranking(integer, boolean, text) TO authenticated;