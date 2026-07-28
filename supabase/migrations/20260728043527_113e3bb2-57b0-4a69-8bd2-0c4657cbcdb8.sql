
-- Sesi Penilaian
CREATE TABLE IF NOT EXISTS public.sesi_penilaian (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  mazmur_id uuid REFERENCES public.mazmur(id) ON DELETE SET NULL,
  kategori text,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sesi_penilaian TO authenticated;
GRANT ALL ON public.sesi_penilaian TO service_role;

ALTER TABLE public.sesi_penilaian ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read sesi_penilaian authenticated"
  ON public.sesi_penilaian FOR SELECT TO authenticated USING (true);

CREATE POLICY "panitia or admin insert sesi"
  ON public.sesi_penilaian FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia'));

CREATE POLICY "panitia or admin update sesi"
  ON public.sesi_penilaian FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia'));

CREATE POLICY "admin delete sesi"
  ON public.sesi_penilaian FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS sesi_penilaian_one_active_per_kategori
  ON public.sesi_penilaian ((COALESCE(kategori,'__all__')))
  WHERE status = 'active';

DROP TRIGGER IF EXISTS sesi_penilaian_set_updated_at ON public.sesi_penilaian;
CREATE TRIGGER sesi_penilaian_set_updated_at
  BEFORE UPDATE ON public.sesi_penilaian
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit log
CREATE TABLE IF NOT EXISTS public.operator_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_nama text,
  role text,
  action text NOT NULL,
  session_id uuid,
  peserta_id uuid,
  mazmur_id uuid,
  ip_address text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.operator_audit_log TO authenticated;
GRANT ALL ON public.operator_audit_log TO service_role;

ALTER TABLE public.operator_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read audit"
  ON public.operator_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "panitia or admin insert audit"
  ON public.operator_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia'))
  );

-- Allow panitia to update peserta (reorder nomor_urut)
CREATE POLICY "panitia update peserta"
  ON public.peserta FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'panitia'))
  WITH CHECK (public.has_role(auth.uid(),'panitia'));

-- Functions
CREATE OR REPLACE FUNCTION public.mulai_sesi(_peserta uuid, _mazmur uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  kat text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT kategori INTO kat FROM public.peserta WHERE id = _peserta;

  UPDATE public.sesi_penilaian
     SET status='selesai', ended_at=now()
   WHERE status='active' AND COALESCE(kategori,'__all__') = COALESCE(kat,'__all__');

  INSERT INTO public.sesi_penilaian(peserta_id, mazmur_id, kategori, status, created_by)
  VALUES (_peserta, _mazmur, kat, 'active', auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, mazmur_id)
  VALUES (auth.uid(), 'mulai_sesi', new_id, _peserta, _mazmur);

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.akhiri_sesi(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.sesi_penilaian
     SET status='selesai', ended_at=now()
   WHERE id = _id;

  INSERT INTO public.operator_audit_log(user_id, action, session_id)
  VALUES (auth.uid(), 'akhiri_sesi', _id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ubah_mazmur_sesi(_id uuid, _mazmur uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_peserta uuid;
  cnt int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'panitia')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT peserta_id INTO s_peserta FROM public.sesi_penilaian WHERE id = _id;
  SELECT count(*) INTO cnt FROM public.penilaian_submission WHERE peserta_id = s_peserta;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'Bacaan Mazmur tidak dapat diubah karena proses penilaian telah dimulai.';
  END IF;

  UPDATE public.sesi_penilaian SET mazmur_id = _mazmur WHERE id = _id;

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, mazmur_id)
  VALUES (auth.uid(), 'ubah_mazmur', _id, s_peserta, _mazmur);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mulai_sesi(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.akhiri_sesi(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ubah_mazmur_sesi(uuid, uuid) TO authenticated;
