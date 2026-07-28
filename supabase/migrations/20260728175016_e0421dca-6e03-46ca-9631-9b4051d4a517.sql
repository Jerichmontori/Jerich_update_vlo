CREATE OR REPLACE FUNCTION public.akhiri_sesi(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _peserta uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT peserta_id INTO _peserta FROM public.sesi_penilaian WHERE id = _id;

  UPDATE public.sesi_penilaian
     SET status='selesai', ended_at=now()
   WHERE id = _id;

  IF _peserta IS NOT NULL THEN
    DELETE FROM public.penilaian p
     USING public.kriteria k
     WHERE p.peserta_id = _peserta
       AND p.kriteria_id = k.id
       AND (lower(k.nama) LIKE '%catatan%' OR lower(k.nama) LIKE '%perhatian%');

    DELETE FROM public.penilaian_submission WHERE peserta_id = _peserta;
  END IF;

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id)
  VALUES (auth.uid(), 'akhiri_sesi', _id, _peserta);
END;
$$;