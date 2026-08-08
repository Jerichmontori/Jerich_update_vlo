CREATE OR REPLACE VIEW public.juri_public
WITH (security_invoker = true) AS
SELECT id, nama, jabatan, role, approved, bacaan_mazmur, jumlah_ayat, created_at, is_dummy, aktif_menilai
FROM public.juri;