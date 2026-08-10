
CREATE INDEX IF NOT EXISTS idx_sesi_penilaian_peserta_started ON public.sesi_penilaian (peserta_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ps_peserta_cache ON public.penilaian_submission (peserta_id) WHERE nilai_cache IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vcs_peserta_created ON public.var_clarification_session (peserta_id, created_at DESC);

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
  WITH jp AS (
    SELECT j.id, j.is_dummy, j.created_at
    FROM public.juri j
    WHERE j.approved = true AND j.role = 'juri'::app_role AND j.aktif_menilai = true
  ),
  base AS (
    SELECT p.id, p.nomor_urut, p.nama, p.kategori, p.terlambat,
           (upper(coalesce(p.kategori,'')) = 'UJICOBA') AS uji,
           sp.id AS sesi_id, sp.status AS sesi_status, sp.mazmur_id,
           COALESCE(sp.started_at, now()) AS cutoff
    FROM public.peserta p
    LEFT JOIN LATERAL (
      SELECT s.id, s.status, s.mazmur_id, s.started_at
      FROM public.sesi_penilaian s
      WHERE s.peserta_id = p.id
      ORDER BY s.started_at DESC
      LIMIT 1
    ) sp ON true
  )
  SELECT
    b.id,
    b.nomor_urut,
    b.nama,
    b.kategori,
    COALESCE(m.bacaan, '-'),
    CASE
      WHEN b.terlambat THEN 'Terlambat'
      WHEN vs.id IS NOT NULL AND vs.status = 'perbaikan_perhatian' THEN 'Perbaikan Perhatian'
      WHEN vs.id IS NOT NULL THEN 'Potensi VAR'
      WHEN COALESCE(sub.n, 0) >= jt.n AND jt.n > 0 THEN 'Final'
      WHEN b.sesi_id IS NOT NULL AND b.sesi_status = 'active' THEN 'Sedang Dinilai'
      WHEN COALESCE(sub.n, 0) > 0 THEN 'Menunggu Juri'
      ELSE 'Menunggu'
    END,
    COALESCE(sub.n, 0),
    jt.n
  FROM base b
  LEFT JOIN public.mazmur m ON m.id = b.mazmur_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM jp
    WHERE jp.is_dummy = b.uji AND jp.created_at <= b.cutoff
  ) jt ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n
    FROM public.penilaian_submission ps
    JOIN jp ON jp.id = ps.juri_id
    WHERE ps.peserta_id = b.id
      AND ps.nilai_cache IS NOT NULL
      AND jp.is_dummy = b.uji
      AND jp.created_at <= b.cutoff
  ) sub ON true
  LEFT JOIN LATERAL (
    SELECT vcs.id, vcs.status
    FROM public.var_clarification_session vcs
    WHERE vcs.peserta_id = b.id AND vcs.status <> 'final'
    ORDER BY vcs.created_at DESC
    LIMIT 1
  ) vs ON true
  ORDER BY b.nomor_urut;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_ringkasan()
 RETURNS TABLE(total_peserta bigint, sudah_tampil bigint, belum_tampil bigint, sedang_tampil bigint, sesi_aktif bigint, sesi_selesai bigint, total_var bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_juri bigint;
  v_total bigint;
  v_done bigint;
  v_aktif bigint;
  v_selesai bigint;
  v_var bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO v_juri
  FROM public.juri
  WHERE approved AND role='juri'::app_role AND aktif_menilai AND NOT is_dummy;

  SELECT count(*) INTO v_total FROM public.peserta;

  SELECT count(*) INTO v_done FROM (
    SELECT ps.peserta_id
    FROM public.penilaian_submission ps
    JOIN public.juri jj ON jj.id = ps.juri_id AND jj.aktif_menilai
    WHERE ps.nilai_cache IS NOT NULL
    GROUP BY ps.peserta_id
    HAVING count(*) >= v_juri
  ) d;

  SELECT count(*) FILTER (WHERE status='active'), count(*) FILTER (WHERE status='selesai')
  INTO v_aktif, v_selesai
  FROM public.sesi_penilaian;

  SELECT count(*) INTO v_var
  FROM public.var_clarification_session WHERE status <> 'final';

  RETURN QUERY SELECT v_total, v_done, v_total - v_done, v_aktif, v_aktif, v_selesai, v_var;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.inspektur_monitor() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inspektur_ringkasan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_monitor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inspektur_ringkasan() TO authenticated;
