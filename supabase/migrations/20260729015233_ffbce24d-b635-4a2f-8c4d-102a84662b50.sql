DROP POLICY IF EXISTS "read peserta" ON public.peserta;
CREATE POLICY "read peserta" ON public.peserta FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.peserta FROM anon;

DROP POLICY IF EXISTS "Anyone can view kategori" ON public.kategori;
CREATE POLICY "Authenticated can view kategori" ON public.kategori FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.kategori FROM anon;