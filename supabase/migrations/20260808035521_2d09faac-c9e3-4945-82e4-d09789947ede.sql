CREATE OR REPLACE FUNCTION public.peserta_pool_cutoff(_peserta uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT sp.started_at FROM public.sesi_penilaian sp
      WHERE sp.peserta_id = _peserta
      ORDER BY sp.started_at DESC LIMIT 1),
    now()
  );
$$;

REVOKE ALL ON FUNCTION public.peserta_pool_cutoff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peserta_pool_cutoff(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.juri_in_pool(_juri uuid, _peserta uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.juri
     WHERE id = _juri AND approved = true AND role = 'juri'::app_role
       AND aktif_menilai = true
       AND is_dummy = public.is_peserta_uji(_peserta)
       AND created_at <= public.peserta_pool_cutoff(_peserta)
  );
$$;

CREATE OR REPLACE FUNCTION public.juri_pool_count(_peserta uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*) FROM public.juri
   WHERE approved = true AND role = 'juri'::app_role
     AND aktif_menilai = true
     AND is_dummy = public.is_peserta_uji(_peserta)
     AND created_at <= public.peserta_pool_cutoff(_peserta);
$$;