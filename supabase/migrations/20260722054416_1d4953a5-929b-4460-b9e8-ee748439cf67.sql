
-- Drop old permissive policies
DROP POLICY IF EXISTS "public all juri" ON public.juri;
DROP POLICY IF EXISTS "public all kriteria" ON public.kriteria;
DROP POLICY IF EXISTS "public all mazmur" ON public.mazmur;
DROP POLICY IF EXISTS "public all peserta" ON public.peserta;
DROP POLICY IF EXISTS "public all penilaian" ON public.penilaian;

-- Grants: allow anon read for public ranking/landing, authenticated for app
GRANT SELECT ON public.juri, public.kriteria, public.mazmur, public.peserta, public.penilaian TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.juri, public.kriteria, public.mazmur, public.peserta, public.penilaian TO authenticated;

-- Public read policies
CREATE POLICY "read juri" ON public.juri FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read kriteria" ON public.kriteria FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read mazmur" ON public.mazmur FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read peserta" ON public.peserta FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read penilaian" ON public.penilaian FOR SELECT TO anon, authenticated USING (true);

-- Admin-only write for reference tables
CREATE POLICY "admin write juri" ON public.juri FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update juri" ON public.juri FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete juri" ON public.juri FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin write kriteria" ON public.kriteria FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update kriteria" ON public.kriteria FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete kriteria" ON public.kriteria FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin write mazmur" ON public.mazmur FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update mazmur" ON public.mazmur FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete mazmur" ON public.mazmur FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin write peserta" ON public.peserta FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update peserta" ON public.peserta FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete peserta" ON public.peserta FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Penilaian: juri can write own; admin can manage all
CREATE POLICY "juri insert own penilaian" ON public.penilaian FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "juri update own penilaian" ON public.penilaian FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "admin delete penilaian" ON public.penilaian FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin new.updated_at = now(); return new; end;
$$;

-- Restrict has_role execution to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
