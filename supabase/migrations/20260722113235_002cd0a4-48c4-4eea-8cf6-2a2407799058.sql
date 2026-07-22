CREATE TABLE public.kategori (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kategori TEXT NOT NULL,
  batas_atas NUMERIC NOT NULL DEFAULT 0,
  batas_bawah NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kategori TO authenticated;
GRANT SELECT ON public.kategori TO anon;
GRANT ALL ON public.kategori TO service_role;
ALTER TABLE public.kategori ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view kategori" ON public.kategori FOR SELECT USING (true);
CREATE POLICY "Admins manage kategori" ON public.kategori FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_kategori_updated_at BEFORE UPDATE ON public.kategori FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();