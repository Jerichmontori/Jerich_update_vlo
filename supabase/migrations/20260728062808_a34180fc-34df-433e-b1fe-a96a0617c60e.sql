
-- ============ system_config ============
CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.system_config TO authenticated;
GRANT ALL ON public.system_config TO service_role;

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read system_config authenticated"
  ON public.system_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write system_config"
  ON public.system_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin update system_config"
  ON public.system_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete system_config"
  ON public.system_config FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_system_config_updated
BEFORE UPDATE ON public.system_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.system_config(key, value)
VALUES ('inspektur_var_approval_required', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ var_review ============
CREATE TABLE IF NOT EXISTS public.var_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  peserta_id uuid NOT NULL,
  inspektur_id uuid NOT NULL,
  catatan text,
  keputusan text NOT NULL DEFAULT 'catatan_saja',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.var_review TO authenticated;
GRANT ALL ON public.var_review TO service_role;

ALTER TABLE public.var_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read var_review privileged"
  ON public.var_review FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'panitia'::app_role)
    OR public.has_role(auth.uid(), 'inspektur'::app_role)
    OR public.has_role(auth.uid(), 'ketua_juri'::app_role)
  );

CREATE POLICY "inspektur insert var_review"
  ON public.var_review FOR INSERT TO authenticated
  WITH CHECK (
    inspektur_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'inspektur'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "admin update var_review"
  ON public.var_review FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin delete var_review"
  ON public.var_review FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ Extend existing policies for inspektur (read-only) ============
CREATE POLICY "inspektur read audit"
  ON public.operator_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'inspektur'::app_role));

CREATE POLICY "inspektur insert own audit"
  ON public.operator_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_role(auth.uid(), 'inspektur'::app_role)
  );

-- Inspektur reads penilaian only after all juri have submitted for that peserta
CREATE OR REPLACE FUNCTION public.all_juri_submitted(_peserta uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    (SELECT count(*) FROM public.juri WHERE approved = true AND role = 'juri')
    <= (SELECT count(*) FROM public.penilaian_submission WHERE peserta_id = _peserta)
  ) AND (SELECT count(*) FROM public.juri WHERE approved = true AND role = 'juri') > 0;
$$;
REVOKE EXECUTE ON FUNCTION public.all_juri_submitted(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.all_juri_submitted(uuid) TO authenticated, service_role;

CREATE POLICY "inspektur read penilaian after complete"
  ON public.penilaian FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'inspektur'::app_role)
    AND public.all_juri_submitted(peserta_id)
  );

-- ============ Functions for Inspektur ============
CREATE OR REPLACE FUNCTION public.inspektur_ringkasan()
RETURNS TABLE(
  total_peserta bigint,
  sudah_tampil bigint,
  belum_tampil bigint,
  sedang_tampil bigint,
  sesi_aktif bigint,
  sesi_selesai bigint,
  total_var bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH j AS (
    SELECT count(*) AS n FROM public.juri WHERE approved = true AND role = 'juri'
  ),
  done AS (
    SELECT ps.peserta_id
    FROM public.penilaian_submission ps
    GROUP BY ps.peserta_id
    HAVING count(*) >= (SELECT n FROM j)
  ),
  active AS (
    SELECT peserta_id FROM public.sesi_penilaian WHERE status = 'active'
  ),
  vars AS (
    SELECT p.id AS peserta_id
    FROM public.peserta p
    JOIN public.penilaian pn ON pn.peserta_id = p.id
    GROUP BY p.id
    HAVING count(DISTINCT pn.mazmur_id) > 1
  )
  SELECT
    (SELECT count(*) FROM public.peserta),
    (SELECT count(*) FROM done),
    (SELECT count(*) FROM public.peserta) - (SELECT count(*) FROM done),
    (SELECT count(*) FROM active),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status = 'active'),
    (SELECT count(*) FROM public.sesi_penilaian WHERE status = 'selesai'),
    (SELECT count(*) FROM vars);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inspektur_ringkasan() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_ringkasan() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inspektur_monitor()
RETURNS TABLE(
  peserta_id uuid,
  nomor_urut integer,
  nama text,
  kategori text,
  bacaan text,
  status text,
  juri_done bigint,
  juri_total bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  jtotal bigint;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO jtotal FROM public.juri WHERE approved = true AND role = 'juri';

  RETURN QUERY
  SELECT
    p.id,
    p.nomor_urut,
    p.nama,
    p.kategori,
    COALESCE(m.bacaan, '-') AS bacaan,
    CASE
      WHEN sp.id IS NOT NULL AND sp.status = 'active' AND COALESCE(sub.n,0) < jtotal THEN 'Sedang Dinilai'
      WHEN sp.id IS NOT NULL AND sp.status = 'active' AND COALESCE(sub.n,0) >= jtotal THEN 'Menunggu Juri'
      WHEN COALESCE(sub.n,0) >= jtotal AND jtotal > 0 AND (vd.mazmur_count IS NULL OR vd.mazmur_count <= 1) THEN 'Final'
      WHEN vd.mazmur_count IS NOT NULL AND vd.mazmur_count > 1 THEN 'Potensi VAR'
      WHEN COALESCE(sub.n,0) > 0 THEN 'Sedang Dinilai'
      ELSE 'Menunggu'
    END AS status,
    COALESCE(sub.n, 0),
    jtotal
  FROM public.peserta p
  LEFT JOIN LATERAL (
    SELECT s.id, s.status, s.mazmur_id
    FROM public.sesi_penilaian s
    WHERE s.peserta_id = p.id
    ORDER BY s.started_at DESC LIMIT 1
  ) sp ON true
  LEFT JOIN public.mazmur m ON m.id = sp.mazmur_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM public.penilaian_submission ps WHERE ps.peserta_id = p.id
  ) sub ON true
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT pn.mazmur_id) AS mazmur_count
    FROM public.penilaian pn WHERE pn.peserta_id = p.id
  ) vd ON true
  ORDER BY p.nomor_urut;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inspektur_monitor() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_monitor() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inspektur_list_var()
RETURNS TABLE(
  peserta_id uuid,
  nomor_urut integer,
  nama text,
  kategori text,
  mazmur_variants jsonb,
  juri_berbeda bigint,
  detected_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH grp AS (
    SELECT pn.peserta_id,
           jsonb_agg(DISTINCT jsonb_build_object('mazmur_id', pn.mazmur_id, 'bacaan', m.bacaan)) AS mazmur_variants,
           count(DISTINCT pn.mazmur_id) AS n_mazmur,
           count(DISTINCT pn.juri_id) AS n_juri,
           max(pn.created_at) AS last_at
    FROM public.penilaian pn
    LEFT JOIN public.mazmur m ON m.id = pn.mazmur_id
    GROUP BY pn.peserta_id
    HAVING count(DISTINCT pn.mazmur_id) > 1
  )
  SELECT p.id, p.nomor_urut, p.nama, p.kategori, g.mazmur_variants, g.n_juri, g.last_at
  FROM grp g
  JOIN public.peserta p ON p.id = g.peserta_id
  ORDER BY p.nomor_urut;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inspektur_list_var() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_list_var() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inspektur_var_detail(_peserta uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'peserta', (SELECT to_jsonb(p) FROM public.peserta p WHERE p.id = _peserta),
    'nilai', (
      SELECT jsonb_agg(jsonb_build_object(
        'juri_id', pn.juri_id,
        'juri_nama', j.nama,
        'kriteria_id', pn.kriteria_id,
        'kriteria', k.nama,
        'nilai', pn.nilai,
        'mazmur_id', pn.mazmur_id,
        'bacaan', m.bacaan,
        'detail', pn.detail,
        'created_at', pn.created_at
      ))
      FROM public.penilaian pn
      LEFT JOIN public.juri j ON j.id = pn.juri_id
      LEFT JOIN public.kriteria k ON k.id = pn.kriteria_id
      LEFT JOIN public.mazmur m ON m.id = pn.mazmur_id
      WHERE pn.peserta_id = _peserta
    ),
    'catatan', (
      SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC)
      FROM public.var_review v WHERE v.peserta_id = _peserta
    )
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inspektur_var_detail(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_var_detail(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inspektur_catat(_peserta uuid, _catatan text, _keputusan text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
  approval_required boolean;
  sesi uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT (value)::text::boolean INTO approval_required
  FROM public.system_config WHERE key = 'inspektur_var_approval_required';
  IF approval_required IS NULL THEN approval_required := false; END IF;

  IF _keputusan IN ('disetujui','ditolak') AND NOT approval_required THEN
    RAISE EXCEPTION 'Persetujuan Inspektur tidak diaktifkan';
  END IF;
  IF _keputusan NOT IN ('catatan_saja','disetujui','ditolak','pending') THEN
    RAISE EXCEPTION 'Keputusan tidak valid';
  END IF;

  SELECT id INTO sesi FROM public.sesi_penilaian
  WHERE peserta_id = _peserta ORDER BY started_at DESC LIMIT 1;

  INSERT INTO public.var_review(session_id, peserta_id, inspektur_id, catatan, keputusan)
  VALUES (sesi, _peserta, auth.uid(), _catatan, _keputusan)
  RETURNING id INTO new_id;

  INSERT INTO public.operator_audit_log(user_id, action, session_id, peserta_id, metadata)
  VALUES (
    auth.uid(),
    CASE _keputusan
      WHEN 'disetujui' THEN 'inspektur_setuju_var'
      WHEN 'ditolak' THEN 'inspektur_tolak_var'
      ELSE 'inspektur_catatan'
    END,
    sesi, _peserta,
    jsonb_build_object('catatan', _catatan, 'keputusan', _keputusan)
  );

  RETURN new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inspektur_catat(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.inspektur_catat(uuid,text,text) TO authenticated, service_role;
