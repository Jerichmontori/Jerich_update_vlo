
-- PESERTA
CREATE TABLE public.peserta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_urut int NOT NULL,
  nama text NOT NULL,
  asal text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peserta TO anon, authenticated;
GRANT ALL ON public.peserta TO service_role;
ALTER TABLE public.peserta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all peserta" ON public.peserta FOR ALL USING (true) WITH CHECK (true);

-- JURI
CREATE TABLE public.juri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  jabatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.juri TO anon, authenticated;
GRANT ALL ON public.juri TO service_role;
ALTER TABLE public.juri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all juri" ON public.juri FOR ALL USING (true) WITH CHECK (true);

-- KRITERIA
CREATE TABLE public.kriteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  bobot numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kriteria TO anon, authenticated;
GRANT ALL ON public.kriteria TO service_role;
ALTER TABLE public.kriteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all kriteria" ON public.kriteria FOR ALL USING (true) WITH CHECK (true);

-- PENILAIAN
CREATE TABLE public.penilaian (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  juri_id uuid NOT NULL REFERENCES public.juri(id) ON DELETE CASCADE,
  kriteria_id uuid NOT NULL REFERENCES public.kriteria(id) ON DELETE CASCADE,
  nilai numeric NOT NULL CHECK (nilai >= 0 AND nilai <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (peserta_id, juri_id, kriteria_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penilaian TO anon, authenticated;
GRANT ALL ON public.penilaian TO service_role;
ALTER TABLE public.penilaian ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all penilaian" ON public.penilaian FOR ALL USING (true) WITH CHECK (true);

-- RANKING (view)
CREATE VIEW public.ranking AS
SELECT
  p.id AS peserta_id,
  p.nomor_urut,
  p.nama,
  p.asal,
  COALESCE(SUM(pn.nilai * k.bobot) / NULLIF(SUM(k.bobot) * GREATEST(COUNT(DISTINCT pn.juri_id),1), 0) * GREATEST(COUNT(DISTINCT pn.juri_id),1), 0) AS total_skor,
  COALESCE(AVG(pn.nilai), 0) AS rata_rata,
  COUNT(DISTINCT pn.juri_id) AS jumlah_juri
FROM public.peserta p
LEFT JOIN public.penilaian pn ON pn.peserta_id = p.id
LEFT JOIN public.kriteria k ON k.id = pn.kriteria_id
GROUP BY p.id, p.nomor_urut, p.nama, p.asal;

GRANT SELECT ON public.ranking TO anon, authenticated, service_role;
