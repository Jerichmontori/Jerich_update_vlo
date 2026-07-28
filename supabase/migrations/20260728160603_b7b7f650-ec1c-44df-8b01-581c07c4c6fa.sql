
CREATE OR REPLACE FUNCTION public.inspektur_terapkan_perbaikan(_peserta uuid, _catatan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sesi uuid;
  v_var uuid;
  v_review uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'inspektur'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT id INTO v_sesi FROM public.sesi_penilaian
   WHERE peserta_id = _peserta ORDER BY started_at DESC LIMIT 1;

  UPDATE public.var_clarification_session
     SET status = 'final',
         komponen_berbeda = '[]'::jsonb,
         finalized_at = now(),
         updated_at = now()
   WHERE peserta_id = _peserta AND status <> 'final'
   RETURNING id INTO v_var;

  INSERT INTO public.var_review(session_id, peserta_id, inspektur_id, catatan, keputusan)
  VALUES (v_sesi, _peserta, v_uid, _catatan, 'diterapkan')
  RETURNING id INTO v_review;

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, metadata)
  VALUES (v_uid, 'inspektur_terapkan_perbaikan', v_sesi, _peserta,
          jsonb_build_object('catatan', _catatan, 'var_session_id', v_var));

  RETURN v_review;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inspektur_terapkan_perbaikan(uuid, text) TO authenticated, service_role;
