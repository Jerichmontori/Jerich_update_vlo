
CREATE TABLE public.penilaian_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  juri_id uuid NOT NULL REFERENCES public.juri(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (peserta_id, juri_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.penilaian_submission TO authenticated;
GRANT ALL ON public.penilaian_submission TO service_role;

ALTER TABLE public.penilaian_submission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read submission own or admin" ON public.penilaian_submission
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR juri_id = (SELECT profiles.juri_id FROM profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "juri insert own submission" ON public.penilaian_submission
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR juri_id = (SELECT profiles.juri_id FROM profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "juri delete own submission" ON public.penilaian_submission
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR juri_id = (SELECT profiles.juri_id FROM profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "juri update own submission" ON public.penilaian_submission
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR juri_id = (SELECT profiles.juri_id FROM profiles WHERE profiles.id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR juri_id = (SELECT profiles.juri_id FROM profiles WHERE profiles.id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.get_ranking()
 RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, asal text, total_skor numeric, rata_rata numeric, jumlah_juri bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id AS peserta_id,
         p.nomor_urut,
         p.nama,
         p.asal,
         COALESCE(sum(pn.nilai * k.bobot), 0::numeric) AS total_skor,
         COALESCE(avg(pn.nilai), 0::numeric) AS rata_rata,
         COALESCE((SELECT count(*) FROM public.penilaian_submission ps WHERE ps.peserta_id = p.id), 0::bigint) AS jumlah_juri
  FROM public.peserta p
  LEFT JOIN public.penilaian pn ON pn.peserta_id = p.id
  LEFT JOIN public.kriteria  k  ON k.id = pn.kriteria_id
  GROUP BY p.id, p.nomor_urut, p.nama, p.asal;
$function$;
