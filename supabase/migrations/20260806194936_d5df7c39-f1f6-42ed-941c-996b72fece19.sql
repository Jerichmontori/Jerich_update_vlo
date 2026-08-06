CREATE OR REPLACE VIEW public.juri_public AS
SELECT id, nama, jabatan, role, approved, bacaan_mazmur, jumlah_ayat, created_at, is_dummy
FROM public.juri;