DROP FUNCTION IF EXISTS public.get_ranking();

CREATE OR REPLACE FUNCTION public.get_ranking()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, asal text, total_skor numeric, rata_rata numeric, jumlah_juri bigint, nilai_akhir numeric, var_status text, juri_total_sum numeric, juri_spread numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH per_juri AS (
    SELECT ps.peserta_id, ps.juri_id, public.hitung_nilai_juri(ps.peserta_id, ps.juri_id) AS nj
    FROM public.penilaian_submission ps
  ),
  agg AS (
    SELECT peserta_id,
           SUM(nj) AS juri_total_sum,
           (COALESCE(MAX(nj),0) - COALESCE(MIN(nj),0)) AS juri_spread
    FROM per_juri
    GROUP BY peserta_id
  )
  SELECT p.id AS peserta_id,
         p.nomor_urut,
         p.nama,
         p.asal,
         COALESCE(sum(pn.nilai * k.bobot), 0)::numeric AS total_skor,
         COALESCE(avg(pn.nilai), 0)::numeric AS rata_rata,
         COALESCE((SELECT count(*) FROM public.penilaian_submission ps WHERE ps.peserta_id=p.id), 0)::bigint AS jumlah_juri,
         public.hitung_nilai_akhir(p.id) AS nilai_akhir,
         (SELECT status FROM public.var_clarification_session vs WHERE vs.peserta_id=p.id AND vs.status <> 'final' LIMIT 1) AS var_status,
         COALESCE((SELECT juri_total_sum FROM agg WHERE agg.peserta_id=p.id), 0)::numeric AS juri_total_sum,
         COALESCE((SELECT juri_spread FROM agg WHERE agg.peserta_id=p.id), 0)::numeric AS juri_spread
  FROM public.peserta p
  LEFT JOIN public.penilaian pn ON pn.peserta_id=p.id
  LEFT JOIN public.kriteria k ON k.id=pn.kriteria_id
  GROUP BY p.id, p.nomor_urut, p.nama, p.asal
  ORDER BY
    public.hitung_nilai_akhir(p.id) DESC NULLS LAST,
    COALESCE((SELECT juri_total_sum FROM agg WHERE agg.peserta_id=p.id), 0) DESC,
    COALESCE((SELECT juri_spread FROM agg WHERE agg.peserta_id=p.id), 0) DESC,
    p.nomor_urut ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_ranking() TO authenticated, anon;