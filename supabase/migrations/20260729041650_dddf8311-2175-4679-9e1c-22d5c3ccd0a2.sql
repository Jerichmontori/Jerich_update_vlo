
CREATE TABLE public.masukan_juri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  juri_id uuid NOT NULL REFERENCES public.juri(id) ON DELETE CASCADE,
  mazmur_id uuid REFERENCES public.mazmur(id) ON DELETE SET NULL,
  catatan jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (peserta_id, juri_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.masukan_juri TO authenticated;
GRANT ALL ON public.masukan_juri TO service_role;

ALTER TABLE public.masukan_juri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage masukan_juri"
  ON public.masukan_juri FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "panitia read masukan_juri"
  ON public.masukan_juri FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'panitia'::app_role));

CREATE POLICY "juri read own masukan"
  ON public.masukan_juri FOR SELECT TO authenticated
  USING (juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "juri insert own masukan"
  ON public.masukan_juri FOR INSERT TO authenticated
  WITH CHECK (juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "juri update own masukan"
  ON public.masukan_juri FOR UPDATE TO authenticated
  USING (juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "juri delete own masukan"
  ON public.masukan_juri FOR DELETE TO authenticated
  USING (juri_id = (SELECT juri_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER trg_masukan_juri_updated_at
  BEFORE UPDATE ON public.masukan_juri
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
