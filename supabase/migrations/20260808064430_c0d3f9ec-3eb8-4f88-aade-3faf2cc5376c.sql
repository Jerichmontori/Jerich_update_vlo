CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, asal text, total_skor numeric, rata_rata numeric, jumlah_juri bigint, nilai_akhir numeric, var_status text, juri_total_sum numeric, juri_spread numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_juri AS (
    SELECT ps.peserta_id, ps.juri_id, public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) AS nj
    FROM public.penilaian_submission ps
  ),
  valid_juri AS (SELECT * FROM per_juri WHERE nj IS NOT NULL),
  agg AS (
    SELECT vj.peserta_id,
           SUM(vj.nj) AS juri_total_sum,
           (COALESCE(MAX(vj.nj),0) - COALESCE(MIN(vj.nj),0)) AS juri_spread,
           AVG(vj.nj) AS juri_avg,
           COUNT(*)::bigint AS jumlah_juri
    FROM valid_juri vj GROUP BY vj.peserta_id
  ),
  base AS (
    SELECT p.id AS peserta_id, p.nomor_urut, p.nama, p.asal, p.terlambat, p.kategori,
           COALESCE(a.juri_total_sum,0)::numeric AS juri_total_sum,
           COALESCE(a.juri_spread,0)::numeric AS juri_spread,
           COALESCE(a.jumlah_juri,0)::bigint AS jumlah_juri,
           a.juri_avg,
           (SELECT k.batas_bawah FROM public.kategori k
              WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(p.kategori,'')))
              ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST LIMIT 1) AS bb,
           (SELECT k.batas_atas FROM public.kategori k
              WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(p.kategori,'')))
              ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST LIMIT 1) AS ba
    FROM public.peserta p
    LEFT JOIN agg a ON a.peserta_id = p.id
  ),
  calc AS (
    SELECT b.*,
      CASE
        WHEN COALESCE(b.terlambat,false) THEN 1::numeric
        WHEN b.juri_avg IS NULL THEN NULL
        ELSE round(GREATEST(COALESCE(b.bb,0), LEAST(COALESCE(b.ba,100), b.juri_avg)), 3)
      END AS na
    FROM base b
  )
  SELECT c.peserta_id, c.nomor_urut, c.nama, c.asal,
         c.juri_total_sum AS total_skor,
         COALESCE(c.na,0)::numeric AS rata_rata,
         c.jumlah_juri,
         c.na AS nilai_akhir,
         (SELECT vs.status FROM public.var_clarification_session vs WHERE vs.peserta_id=c.peserta_id AND vs.status <> 'final' LIMIT 1) AS var_status,
         c.juri_total_sum,
         c.juri_spread
  FROM calc c
  ORDER BY c.na DESC NULLS LAST, c.juri_total_sum DESC, c.juri_spread DESC, c.nomor_urut ASC;
$$;

REVOKE ALL ON FUNCTION public.get_ranking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO anon, authenticated, service_role;