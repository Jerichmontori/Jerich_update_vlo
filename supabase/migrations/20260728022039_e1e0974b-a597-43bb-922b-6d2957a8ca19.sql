CREATE OR REPLACE FUNCTION public.get_ranking()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, asal text, total_skor numeric, rata_rata numeric, jumlah_juri bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH kri AS (
    SELECT count(*)::bigint AS total FROM public.kriteria
  ),
  juri_lengkap AS (
    SELECT pn.peserta_id, pn.juri_id
    FROM public.penilaian pn
    GROUP BY pn.peserta_id, pn.juri_id
    HAVING count(DISTINCT pn.kriteria_id) >= (SELECT total FROM kri)
  )
  SELECT p.id AS peserta_id,
         p.nomor_urut,
         p.nama,
         p.asal,
         COALESCE(sum(pn.nilai * k.bobot), 0::numeric) AS total_skor,
         COALESCE(avg(pn.nilai), 0::numeric) AS rata_rata,
         COALESCE((SELECT count(*) FROM juri_lengkap jl WHERE jl.peserta_id = p.id), 0::bigint) AS jumlah_juri
  FROM public.peserta p
  LEFT JOIN public.penilaian pn ON pn.peserta_id = p.id
  LEFT JOIN public.kriteria  k  ON k.id = pn.kriteria_id
  GROUP BY p.id, p.nomor_urut, p.nama, p.asal;
$function$;