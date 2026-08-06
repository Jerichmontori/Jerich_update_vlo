ALTER TABLE public.peserta
  ADD COLUMN IF NOT EXISTS terlambat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terlambat_at timestamptz;

-- Peserta terlambat: nilai akhir dipaksa 1
CREATE OR REPLACE FUNCTION public.hitung_nilai_akhir(_peserta uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total numeric := 0; cnt int := 0; v numeric;
  jid uuid; bb numeric; ba numeric; kat_p text; late boolean;
BEGIN
  SELECT terlambat INTO late FROM public.peserta WHERE id=_peserta;
  IF COALESCE(late,false) THEN RETURN 1; END IF;

  FOR jid IN SELECT DISTINCT juri_id FROM public.penilaian_submission WHERE peserta_id=_peserta LOOP
    v := public.hitung_nilai_juri(_peserta, jid);
    IF v IS NOT NULL THEN total := total + v; cnt := cnt + 1; END IF;
  END LOOP;
  IF cnt = 0 THEN RETURN NULL; END IF;

  SELECT kategori INTO kat_p FROM public.peserta WHERE id=_peserta;
  SELECT k.batas_bawah, k.batas_atas INTO bb, ba
  FROM public.kategori AS k
  WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(kat_p,'')))
  ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST
  LIMIT 1;
  IF bb IS NULL THEN bb := 0; ba := 100; END IF;

  v := total / cnt;
  v := GREATEST(bb, LEAST(ba, v));
  RETURN round(v, 3);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_peserta_final(_peserta uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT terlambat FROM public.peserta WHERE id=_peserta), false)
     OR (
       public.all_juri_submitted(_peserta)
       AND public.hitung_nilai_akhir(_peserta) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.var_clarification_session v
         WHERE v.peserta_id = _peserta AND v.status <> 'final'
       )
     );
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_monitor()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, kategori text, bacaan text, status text, juri_done bigint, juri_total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_vmix_viewer(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS peserta_id,
    p.nomor_urut,
    p.nama,
    p.kategori,
    COALESCE(m.bacaan, '-') AS bacaan,
    CASE
      WHEN p.terlambat THEN 'Terlambat'
      WHEN vs.id IS NOT NULL AND vs.status = 'perbaikan_perhatian' THEN 'Perbaikan Perhatian'
      WHEN vs.id IS NOT NULL THEN 'Potensi VAR'
      WHEN COALESCE(sub.n, 0) >= jt.n AND jt.n > 0 THEN 'Final'
      WHEN sp.id IS NOT NULL AND sp.status = 'active' THEN 'Sedang Dinilai'
      WHEN COALESCE(sub.n, 0) > 0 THEN 'Menunggu Juri'
      ELSE 'Menunggu'
    END AS status,
    COALESCE(sub.n, 0) AS juri_done,
    jt.n AS juri_total
  FROM public.peserta AS p
  LEFT JOIN LATERAL (SELECT public.juri_pool_count(p.id) AS n) AS jt ON true
  LEFT JOIN LATERAL (
    SELECT s.id, s.status, s.mazmur_id
    FROM public.sesi_penilaian AS s
    WHERE s.peserta_id = p.id
    ORDER BY s.started_at DESC
    LIMIT 1
  ) AS sp ON true
  LEFT JOIN public.mazmur AS m ON m.id = sp.mazmur_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS n
    FROM public.penilaian_submission AS ps
    WHERE ps.peserta_id = p.id
      AND public.juri_in_pool(ps.juri_id, p.id)
      AND public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) IS NOT NULL
  ) AS sub ON true
  LEFT JOIN LATERAL (
    SELECT vcs.id, vcs.status
    FROM public.var_clarification_session AS vcs
    WHERE vcs.peserta_id = p.id
      AND vcs.status <> 'final'
    ORDER BY vcs.created_at DESC
    LIMIT 1
  ) AS vs ON true
  ORDER BY p.nomor_urut;
END;
$function$;

CREATE OR REPLACE FUNCTION public.viewer_peserta_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Tandai / batalkan peserta terlambat
CREATE OR REPLACE FUNCTION public.set_peserta_terlambat(_peserta uuid, _terlambat boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_uid,'admin'::app_role)
          OR public.has_role(v_uid,'panitia'::app_role)
          OR public.has_role(v_uid,'inspektur'::app_role)
          OR public.has_role(v_uid,'viewer'::app_role)) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  UPDATE public.peserta
     SET terlambat = COALESCE(_terlambat,false),
         terlambat_at = CASE WHEN COALESCE(_terlambat,false) THEN now() ELSE NULL END
   WHERE id = _peserta;

  IF COALESCE(_terlambat,false) THEN
    UPDATE public.sesi_penilaian SET status='selesai', ended_at=now()
     WHERE peserta_id = _peserta AND status='active';
  END IF;

  INSERT INTO public.operator_audit_log(user_id, user_nama, action, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid),
          'set_peserta_terlambat', _peserta,
          jsonb_build_object('terlambat', COALESCE(_terlambat,false)));
END;
$function$;

-- Admin membuka kembali penilaian peserta yang sudah final
CREATE OR REPLACE FUNCTION public.admin_buka_penilaian_ulang(_peserta uuid, _catatan text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sesi uuid;
  v_mazmur uuid;
BEGIN
  IF NOT public.has_role(v_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Tutup semua VAR agar seluruh kriteria terbuka kembali
  UPDATE public.var_clarification_session
     SET status='final', komponen_berbeda='[]'::jsonb,
         finalized_at=COALESCE(finalized_at, now()), updated_at=now()
   WHERE peserta_id = _peserta AND status <> 'final';

  -- Hapus submission agar juri dapat mengirim ulang
  DELETE FROM public.penilaian_submission WHERE peserta_id = _peserta;

  SELECT id, mazmur_id INTO v_sesi, v_mazmur
  FROM public.sesi_penilaian WHERE peserta_id = _peserta
  ORDER BY started_at DESC LIMIT 1;

  IF v_sesi IS NULL THEN
    INSERT INTO public.sesi_penilaian(peserta_id, mazmur_id, status, created_by)
    VALUES (_peserta, NULL, 'active', v_uid)
    RETURNING id INTO v_sesi;
  ELSE
    UPDATE public.sesi_penilaian
       SET status='active', ended_at=NULL, updated_at=now()
     WHERE id = v_sesi;
  END IF;

  UPDATE public.peserta SET terlambat=false, terlambat_at=NULL WHERE id=_peserta;

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, session_id, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid), 'admin',
          'admin_buka_penilaian_ulang', v_sesi, _peserta,
          jsonb_build_object('catatan', _catatan));

  RETURN v_sesi;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_peserta_terlambat(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_buka_penilaian_ulang(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_peserta_terlambat(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buka_penilaian_ulang(uuid, text) TO authenticated;

-- Role user (viewer) dapat mengelola daftar peserta
DROP POLICY IF EXISTS "viewer insert peserta" ON public.peserta;
DROP POLICY IF EXISTS "viewer update peserta" ON public.peserta;
DROP POLICY IF EXISTS "viewer delete peserta" ON public.peserta;
CREATE POLICY "viewer insert peserta" ON public.peserta FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'viewer'::app_role));
CREATE POLICY "viewer update peserta" ON public.peserta FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'viewer'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'viewer'::app_role));
CREATE POLICY "viewer delete peserta" ON public.peserta FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'viewer'::app_role));