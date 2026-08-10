CREATE OR REPLACE FUNCTION public.get_keberatan_deadline()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.system_config WHERE key = 'keberatan_deadline'),
    jsonb_build_object('mode','off','minutes',30,'until',NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.get_keberatan_deadline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_keberatan_deadline() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_keberatan_deadline(_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text := COALESCE(_value->>'mode','off');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah batas waktu keberatan';
  END IF;
  IF v_mode NOT IN ('off','relative','absolute') THEN
    RAISE EXCEPTION 'Mode tidak valid';
  END IF;
  INSERT INTO public.system_config (key, value)
  VALUES ('keberatan_deadline', jsonb_build_object(
    'mode', v_mode,
    'minutes', GREATEST(1, LEAST(10080, COALESCE((_value->>'minutes')::int, 30))),
    'until', NULLIF(_value->>'until','')
  ))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN public.get_keberatan_deadline();
END;
$$;

REVOKE ALL ON FUNCTION public.set_keberatan_deadline(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_keberatan_deadline(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.keberatan_window(_peserta uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb := public.get_keberatan_deadline();
  v_mode text := cfg->>'mode';
  v_min int := COALESCE((cfg->>'minutes')::int, 30);
  v_until timestamptz;
  v_end timestamptz;
  v_deadline timestamptz;
BEGIN
  IF v_mode = 'off' OR v_mode IS NULL THEN
    RETURN jsonb_build_object('open', true, 'mode', 'off', 'deadline', NULL, 'alasan', NULL);
  END IF;

  IF v_mode = 'absolute' THEN
    v_until := NULLIF(cfg->>'until','')::timestamptz;
    IF v_until IS NULL THEN
      RETURN jsonb_build_object('open', true, 'mode', v_mode, 'deadline', NULL, 'alasan', NULL);
    END IF;
    RETURN jsonb_build_object(
      'open', now() <= v_until,
      'mode', v_mode,
      'deadline', v_until,
      'alasan', CASE WHEN now() > v_until THEN 'Batas waktu pengajuan keberatan telah berakhir.' ELSE NULL END
    );
  END IF;

  -- relative: dihitung dari akhir sesi penilaian peserta
  SELECT MAX(sp.ended_at) INTO v_end
  FROM public.sesi_penilaian sp
  WHERE sp.peserta_id = _peserta AND sp.ended_at IS NOT NULL;

  IF v_end IS NULL THEN
    RETURN jsonb_build_object('open', true, 'mode', v_mode, 'deadline', NULL, 'alasan', NULL);
  END IF;

  v_deadline := v_end + make_interval(mins => v_min);
  RETURN jsonb_build_object(
    'open', now() <= v_deadline,
    'mode', v_mode,
    'deadline', v_deadline,
    'alasan', CASE WHEN now() > v_deadline
      THEN 'Batas waktu pengajuan keberatan untuk peserta ini telah berakhir (' || v_min || ' menit setelah penilaian selesai).'
      ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.keberatan_window(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keberatan_window(uuid) TO anon, authenticated, service_role;