CREATE OR REPLACE FUNCTION public.inspektur_buka_perhatian(_peserta uuid, _catatan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_komponen jsonb;
BEGIN
  IF NOT (public.has_role(v_uid, 'inspektur'::app_role) OR public.has_role(v_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- CATATAN: jangan hapus baris penilaian Perhatian, agar pilihan sebelumnya
  -- masih dapat ditampilkan kembali kepada juri saat mode perbaikan aktif.
  -- Hanya submission yang dihapus supaya tombol Kirim aktif kembali.
  DELETE FROM public.penilaian_submission WHERE peserta_id = _peserta;

  SELECT id, komponen_berbeda INTO v_session_id, v_komponen
  FROM public.var_clarification_session
  WHERE peserta_id = _peserta
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO public.var_clarification_session (peserta_id, status, komponen_berbeda, started_by, started_at)
    VALUES (_peserta, 'perbaikan_perhatian', COALESCE(v_komponen, '[]'::jsonb), v_uid, now())
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.var_clarification_session
    SET status = 'perbaikan_perhatian',
        started_by = v_uid,
        started_at = COALESCE(started_at, now()),
        finalized_at = NULL,
        updated_at = now()
    WHERE id = v_session_id;
  END IF;

  INSERT INTO public.operator_audit_log (user_id, user_nama, role, action, peserta_id, metadata)
  VALUES (
    v_uid,
    (SELECT nama FROM public.profiles WHERE id = v_uid),
    CASE WHEN public.has_role(v_uid,'admin'::app_role) THEN 'admin' ELSE 'inspektur' END,
    'inspektur_buka_perhatian',
    _peserta,
    jsonb_build_object('catatan', _catatan, 'preserve_previous', true)
  );

  RETURN v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.inspektur_buka_perhatian(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.inspektur_buka_perhatian(uuid, text) TO authenticated;