CREATE OR REPLACE FUNCTION public.inspektur_ajukan_live_ranking(_sesi integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE total int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO total
  FROM public.peserta p WHERE ((p.nomor_urut - 1) / 10) + 1 = _sesi;

  IF total = 0 THEN RAISE EXCEPTION 'Sesi tidak ditemukan'; END IF;

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
$function$;