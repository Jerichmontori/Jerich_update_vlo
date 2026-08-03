
CREATE TABLE IF NOT EXISTS public.pengumuman_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  peserta_id uuid REFERENCES public.peserta(id) ON DELETE SET NULL,
  running boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pengumuman_state TO authenticated;
GRANT ALL ON public.pengumuman_state TO service_role;

ALTER TABLE public.pengumuman_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can view pengumuman" ON public.pengumuman_state;
CREATE POLICY "staff can view pengumuman" ON public.pengumuman_state
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'inspektur'::app_role));

INSERT INTO public.pengumuman_state (id, peserta_id, running) VALUES (1, NULL, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_pengumuman_state(_peserta uuid, _running boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'inspektur'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.pengumuman_state (id, peserta_id, running, updated_at)
  VALUES (1, _peserta, COALESCE(_running,false), now())
  ON CONFLICT (id) DO UPDATE
    SET peserta_id = EXCLUDED.peserta_id,
        running = EXCLUDED.running,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_pengumuman_state(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pengumuman_state(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_pengumuman_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  st public.pengumuman_state%ROWTYPE;
  p public.peserta%ROWTYPE;
  juri_arr jsonb;
  akhir numeric;
BEGIN
  SELECT * INTO st FROM public.pengumuman_state WHERE id = 1;
  IF st.peserta_id IS NULL THEN
    RETURN jsonb_build_object('now', now(), 'running', false, 'peserta', NULL, 'juri', '[]'::jsonb, 'nilai_akhir', NULL);
  END IF;

  SELECT * INTO p FROM public.peserta WHERE id = st.peserta_id;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'juri_nama'), '[]'::jsonb) INTO juri_arr
  FROM (
    SELECT jsonb_build_object(
      'juri_nama', j.nama,
      'nilai_juri', public.hitung_nilai_juri(st.peserta_id, j.id)
    ) AS x
    FROM public.juri j
    JOIN public.penilaian_submission ps ON ps.peserta_id = st.peserta_id AND ps.juri_id = j.id
    WHERE j.approved = true AND j.role = 'juri'::app_role
  ) s
  WHERE (x->>'nilai_juri') IS NOT NULL;

  akhir := public.hitung_nilai_akhir(st.peserta_id);

  RETURN jsonb_build_object(
    'now', now(),
    'running', st.running,
    'updated_at', st.updated_at,
    'peserta', jsonb_build_object(
      'peserta_id', p.id,
      'nomor_urut', p.nomor_urut,
      'nama', p.nama,
      'asal', p.asal
    ),
    'juri', juri_arr,
    'nilai_akhir', akhir
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_pengumuman_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_pengumuman_state() TO anon, authenticated, service_role;
