ALTER TABLE public.kategori
  ADD COLUMN IF NOT EXISTS kriteria_penilaian text,
  ADD COLUMN IF NOT EXISTS kriteria_peserta text,
  ADD COLUMN IF NOT EXISTS bobot numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nilai_tengah numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nilai_standart numeric NOT NULL DEFAULT 0;

ALTER TABLE public.kategori ALTER COLUMN kategori DROP NOT NULL;