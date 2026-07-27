
-- 1) Replace ranking view with SECURITY DEFINER function
DROP VIEW IF EXISTS public.ranking;

CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE (
  peserta_id uuid,
  nomor_urut integer,
  nama text,
  asal text,
  total_skor numeric,
  rata_rata numeric,
  jumlah_juri bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS peserta_id,
         p.nomor_urut,
         p.nama,
         p.asal,
         COALESCE(sum(pn.nilai * k.bobot) / NULLIF(sum(k.bobot) * GREATEST(count(DISTINCT pn.juri_id), 1::bigint)::numeric, 0::numeric) * GREATEST(count(DISTINCT pn.juri_id), 1::bigint)::numeric, 0::numeric) AS total_skor,
         COALESCE(avg(pn.nilai), 0::numeric) AS rata_rata,
         count(DISTINCT pn.juri_id) AS jumlah_juri
  FROM public.peserta p
  LEFT JOIN public.penilaian pn ON pn.peserta_id = p.id
  LEFT JOIN public.kriteria  k  ON k.id = pn.kriteria_id
  GROUP BY p.id, p.nomor_urut, p.nama, p.asal;
$$;

REVOKE ALL ON FUNCTION public.get_ranking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO anon, authenticated;

-- 2) Column-level protection for juri.email
--    Authenticated users may only project non-sensitive columns.
--    Admin server functions use the service-role client, which bypasses this.
REVOKE SELECT ON public.juri FROM authenticated;
GRANT SELECT (id, nama, jabatan, bacaan_mazmur, jumlah_ayat, role, approved, created_at, user_id)
  ON public.juri TO authenticated;
-- Keep insert/update/delete grants for admin policies to work through Data API
GRANT INSERT, UPDATE, DELETE ON public.juri TO authenticated;

-- 3) Restrict penilaian reads to admin or the owning juri
DROP POLICY IF EXISTS "read penilaian" ON public.penilaian;
CREATE POLICY "read penilaian own or admin" ON public.penilaian
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR juri_id = (SELECT profiles.juri_id FROM public.profiles WHERE profiles.id = auth.uid())
  );
