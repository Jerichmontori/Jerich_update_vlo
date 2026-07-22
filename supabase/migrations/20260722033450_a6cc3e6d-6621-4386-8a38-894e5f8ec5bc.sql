CREATE TABLE public.mazmur (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bacaan text NOT NULL,
  jumlah_ayat integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mazmur TO anon, authenticated;
GRANT ALL ON public.mazmur TO service_role;
ALTER TABLE public.mazmur ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all mazmur" ON public.mazmur FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.penilaian ADD COLUMN IF NOT EXISTS mazmur_id uuid REFERENCES public.mazmur(id) ON DELETE SET NULL;