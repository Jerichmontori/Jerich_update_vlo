CREATE INDEX IF NOT EXISTS idx_sesi_penilaian_status_started
  ON public.sesi_penilaian (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sesi_penilaian_peserta_started
  ON public.sesi_penilaian (peserta_id, started_at DESC);

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
      AND ps.nilai_cache IS NOT NULL
      AND public.juri_in_pool(ps.juri_id, p.id)
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

CREATE OR REPLACE FUNCTION public.inspektur_ringkasan()
 RETURNS TABLE(total_peserta bigint, sudah_tampil bigint, belum_tampil bigint, sedang_tampil bigint, sesi_aktif bigint, sesi_selesai bigint, total_var bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  WITH j AS (
    SELECT count(*) AS n
    FROM public.juri
    WHERE approved AND role='juri' AND aktif_menilai AND NOT is_dummy
  ),
  done AS (
    SELECT ps.peserta_id
    FROM public.penilaian_submission ps
    JOIN public.juri jj ON jj.id = ps.juri_id AND jj.aktif_menilai
    WHERE ps.nilai_cache IS NOT NULL
    GROUP BY ps.peserta_id
    HAVING count(*) >= (SELECT n FROM j)
  ),
  sesi AS (
    SELECT
      count(*) FILTER (WHERE status='active') AS aktif,
      count(*) FILTER (WHERE status='selesai') AS selesai
    FROM public.sesi_penilaian
  )
  SELECT
    (SELECT count(*) FROM public.peserta),
    (SELECT count(*) FROM done),
    (SELECT count(*) FROM public.peserta) - (SELECT count(*) FROM done),
    (SELECT aktif FROM sesi),
    (SELECT aktif FROM sesi),
    (SELECT selesai FROM sesi),
    (SELECT count(*) FROM public.var_clarification_session WHERE status <> 'final');
END;
$function$;