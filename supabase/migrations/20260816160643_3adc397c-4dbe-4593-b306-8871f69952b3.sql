CREATE OR REPLACE FUNCTION public.admin_buka_penilaian_ulang(_peserta uuid, _catatan text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sesi uuid; v_snap uuid; v_mazmur uuid; v_kategori text;
BEGIN
  IF NOT public.has_role(v_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF _catatan IS NULL OR btrim(_catatan) = '' THEN
    RAISE EXCEPTION 'Alasan buka perbaikan wajib diisi';
  END IF;
  IF public.perbaikan_var_aktif(_peserta) THEN
    RAISE EXCEPTION 'Peserta sedang dalam penanganan VAR Inspektur Pertandingan';
  END IF;

  v_snap := public.buat_perbaikan_snapshot(_peserta, NULL, 'admin_bebas', _catatan);

  UPDATE public.var_clarification_session
     SET status='final', komponen_berbeda='[]'::jsonb,
         finalized_at=COALESCE(finalized_at, now()), updated_at=now()
   WHERE peserta_id = _peserta AND status <> 'final';

  DELETE FROM public.penilaian_submission WHERE peserta_id = _peserta;

  -- Mazmur & kategori terakhir yang dipakai peserta ini, agar form juri tidak kosong
  SELECT sp.mazmur_id, sp.kategori INTO v_mazmur, v_kategori
    FROM public.sesi_penilaian sp
   WHERE sp.peserta_id = _peserta AND sp.mazmur_id IS NOT NULL
   ORDER BY sp.started_at DESC LIMIT 1;

  -- Tutup sesi aktif peserta lain supaya sesi perbaikan ini yang terbaca juri
  UPDATE public.sesi_penilaian
     SET status='selesai', ended_at=COALESCE(ended_at, now()), updated_at=now()
   WHERE status='active' AND peserta_id <> _peserta;

  SELECT id INTO v_sesi FROM public.sesi_penilaian
   WHERE peserta_id = _peserta ORDER BY started_at DESC LIMIT 1;

  IF v_sesi IS NULL THEN
    INSERT INTO public.sesi_penilaian(peserta_id, mazmur_id, kategori, status, created_by)
    VALUES (_peserta, v_mazmur, v_kategori, 'active', v_uid) RETURNING id INTO v_sesi;
  ELSE
    UPDATE public.sesi_penilaian
       SET status='active', ended_at=NULL, started_at=now(), updated_at=now(),
           mazmur_id=COALESCE(mazmur_id, v_mazmur),
           kategori=COALESCE(kategori, v_kategori)
     WHERE id = v_sesi;
  END IF;

  UPDATE public.peserta SET terlambat=false, terlambat_at=NULL WHERE id=_peserta;

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, session_id, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid), 'admin',
          'admin_buka_penilaian_ulang', v_sesi, _peserta,
          jsonb_build_object('catatan', _catatan, 'snapshot_id', v_snap));

  RETURN v_sesi;
END; $function$;