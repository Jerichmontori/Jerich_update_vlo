
DROP FUNCTION IF EXISTS public.inspektur_list_var();
CREATE FUNCTION public.inspektur_list_var()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, kategori text, komponen_berbeda jsonb, status text, bacaan text, juri_berbeda bigint, detected_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT p.id, p.nomor_urut, p.nama, p.kategori,
         s.komponen_berbeda, s.status,
         COALESCE(m.bacaan,'-') AS bacaan,
         (SELECT count(DISTINCT juri_id) FROM public.penilaian WHERE peserta_id = p.id),
         s.created_at
  FROM public.var_clarification_session s
  JOIN public.peserta p ON p.id = s.peserta_id
  LEFT JOIN public.mazmur m ON m.id = s.mazmur_id
  WHERE s.status <> 'final'
  ORDER BY p.nomor_urut;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_var_detail(_peserta uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT jsonb_build_object(
    'peserta', (SELECT to_jsonb(p) FROM public.peserta p WHERE p.id = _peserta),
    'var_session', (
      SELECT jsonb_build_object(
        'id', s.id, 'status', s.status, 'komponen_berbeda', s.komponen_berbeda,
        'bacaan', (SELECT bacaan FROM public.mazmur WHERE id = s.mazmur_id),
        'created_at', s.created_at
      )
      FROM public.var_clarification_session s
      WHERE s.peserta_id = _peserta AND s.status <> 'final'
      ORDER BY s.created_at DESC LIMIT 1
    ),
    'nilai', (
      SELECT jsonb_agg(jsonb_build_object(
        'juri_id', pn.juri_id,'juri_nama', j.nama,'kriteria_id', pn.kriteria_id,
        'kriteria', k.nama,'nilai', pn.nilai,'mazmur_id', pn.mazmur_id,'bacaan', m.bacaan,
        'detail', pn.detail,'created_at', pn.created_at))
      FROM public.penilaian pn
      LEFT JOIN public.juri j ON j.id = pn.juri_id
      LEFT JOIN public.kriteria k ON k.id = pn.kriteria_id
      LEFT JOIN public.mazmur m ON m.id = pn.mazmur_id
      WHERE pn.peserta_id = _peserta),
    'catatan', (
      SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC)
      FROM public.var_review v WHERE v.peserta_id = _peserta)
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_monitor()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, kategori text, bacaan text, status text, juri_done bigint, juri_total bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE jtotal bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT count(*) INTO jtotal FROM public.juri WHERE approved = true AND role = 'juri';
  RETURN QUERY
  SELECT p.id, p.nomor_urut, p.nama, p.kategori,
    COALESCE(m.bacaan, '-') AS bacaan,
    CASE
      WHEN vs.id IS NOT NULL THEN 'Potensi VAR'
      WHEN sp.id IS NOT NULL AND sp.status = 'active' AND COALESCE(sub.n,0) < jtotal THEN 'Sedang Dinilai'
      WHEN sp.id IS NOT NULL AND sp.status = 'active' AND COALESCE(sub.n,0) >= jtotal THEN 'Menunggu Juri'
      WHEN COALESCE(sub.n,0) >= jtotal AND jtotal > 0 THEN 'Final'
      WHEN COALESCE(sub.n,0) > 0 THEN 'Sedang Dinilai'
      ELSE 'Menunggu'
    END AS status,
    COALESCE(sub.n, 0), jtotal
  FROM public.peserta p
  LEFT JOIN LATERAL (
    SELECT s.id, s.status, s.mazmur_id FROM public.sesi_penilaian s
    WHERE s.peserta_id = p.id ORDER BY s.started_at DESC LIMIT 1) sp ON true
  LEFT JOIN public.mazmur m ON m.id = sp.mazmur_id
  LEFT JOIN LATERAL (SELECT count(*) AS n FROM public.penilaian_submission ps WHERE ps.peserta_id = p.id) sub ON true
  LEFT JOIN LATERAL (SELECT id FROM public.var_clarification_session
    WHERE peserta_id = p.id AND status <> 'final' LIMIT 1) vs ON true
  ORDER BY p.nomor_urut;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_ringkasan()
 RETURNS TABLE(total_peserta bigint, sudah_tampil bigint, belum_tampil bigint, sedang_tampil bigint, sesi_aktif bigint, sesi_selesai bigint, total_var bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  WITH j AS (SELECT count(*) AS n FROM public.juri WHERE approved AND role='juri'),
  done AS (SELECT ps.peserta_id FROM public.penilaian_submission ps
           GROUP BY ps.peserta_id HAVING count(*) >= (SELECT n FROM j))
  SELECT
    (SELECT count(*) FROM public.peserta),
    (SELECT count(*) FROM done),
    (SELECT count(*) FROM public.peserta) - (SELECT count(*) FROM done),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status='active'),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status='active'),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status='selesai'),
    (SELECT count(*) FROM public.var_clarification_session WHERE status <> 'final');
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_selesaikan_var(_peserta uuid, _catatan text, _keputusan text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_id uuid; sid uuid; sesi uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _keputusan NOT IN ('disetujui','ditolak','catatan_saja') THEN
    RAISE EXCEPTION 'Keputusan tidak valid';
  END IF;
  SELECT id INTO sesi FROM public.sesi_penilaian
   WHERE peserta_id = _peserta ORDER BY started_at DESC LIMIT 1;
  INSERT INTO public.var_review(session_id, peserta_id, inspektur_id, catatan, keputusan)
  VALUES (sesi, _peserta, auth.uid(), _catatan, _keputusan) RETURNING id INTO new_id;
  UPDATE public.var_clarification_session
    SET status = 'final', finalized_at = now()
   WHERE peserta_id = _peserta AND status <> 'final'
   RETURNING id INTO sid;
  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, metadata)
  VALUES (auth.uid(), 'inspektur_selesaikan_var', sesi, _peserta,
          jsonb_build_object('catatan', _catatan, 'keputusan', _keputusan, 'var_session_id', sid));
  RETURN new_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.inspektur_list_var() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_selesaikan_var(uuid, text, text) TO authenticated;
