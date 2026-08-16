-- === Mode Inspektur: 1 (Inspektur Pertandingan menangani VAR) atau 2 (Inspektur + Inspektur VAR) ===

INSERT INTO public.system_config(key, value)
VALUES ('mode_inspektur', to_jsonb(2))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_mode_inspektur()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT (value)::text::int FROM public.system_config WHERE key = 'mode_inspektur'), 2);
$function$;

CREATE OR REPLACE FUNCTION public.set_mode_inspektur(_jumlah int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengatur mode inspektur';
  END IF;
  IF _jumlah NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Jumlah inspektur harus 1 atau 2';
  END IF;
  INSERT INTO public.system_config(key, value)
  VALUES ('mode_inspektur', to_jsonb(_jumlah))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN _jumlah;
END;
$function$;

-- Helper: true bila user boleh mengakses tool VAR (admin, inspektur_var, atau inspektur saat mode 1)
CREATE OR REPLACE FUNCTION public.is_inspektur_var(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_uid, 'admin')
    OR public.has_role(_uid, 'inspektur_var')
    OR (public.get_mode_inspektur() = 1 AND public.has_role(_uid, 'inspektur'));
$function$;

-- === Kunci pengajuan keberatan saat mode 1 ===
CREATE OR REPLACE FUNCTION public.keberatan_window(_peserta uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg jsonb := public.get_keberatan_deadline();
  v_mode text := cfg->>'mode';
  v_min int := COALESCE((cfg->>'minutes')::int, 30);
  v_until timestamptz;
  v_end timestamptz;
  v_deadline timestamptz;
BEGIN
  IF public.get_mode_inspektur() = 1 THEN
    RETURN jsonb_build_object(
      'open', false,
      'mode', 'locked',
      'deadline', NULL,
      'alasan', 'Pengajuan keberatan tidak diaktifkan pada mode 1 Inspektur (ditangani langsung oleh Inspektur Pertandingan).'
    );
  END IF;

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
$function$;

-- === Fungsi VAR: gunakan is_inspektur_var (agar IP bisa akses saat mode 1) ===

CREATE OR REPLACE FUNCTION public.ip2_buka_perbaikan(_peserta uuid, _catatan text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sid uuid;
  comps jsonb := '["clear_text","salah_kata","menambah_kata","mengurangi_kata"]'::jsonb;
BEGIN
  IF NOT public.is_inspektur_var(auth.uid()) THEN
    RAISE EXCEPTION 'Hanya Inspektur VAR yang dapat membuka perbaikan';
  END IF;

  SELECT id INTO v_sid FROM public.var_clarification_session
   WHERE peserta_id = _peserta AND status <> 'final'
   ORDER BY created_at DESC LIMIT 1;

  IF v_sid IS NULL THEN
    INSERT INTO public.var_clarification_session(peserta_id, mazmur_id, status, komponen_berbeda)
    VALUES (_peserta, (SELECT mazmur_id FROM public.penilaian WHERE peserta_id=_peserta LIMIT 1),
            'perbaikan_var', comps)
    RETURNING id INTO v_sid;
  ELSE
    UPDATE public.var_clarification_session
       SET status = 'perbaikan_var', komponen_berbeda = comps, updated_at = now()
     WHERE id = v_sid;
  END IF;

  UPDATE public.keberatan
     SET perbaikan_dibuka_at = COALESCE(perbaikan_dibuka_at, now()), updated_at = now()
   WHERE peserta_id = _peserta AND status = 'diterima' AND tindak_lanjut = 'var'
     AND perbaikan_selesai_at IS NULL;

  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'ip2_buka_perbaikan', _peserta,
          jsonb_build_object('var_session_id', v_sid, 'catatan', _catatan));

  RETURN v_sid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_notifikasi_perbaikan()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE res jsonb;
BEGIN
  IF NOT public.is_inspektur_var(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'diputus_at' DESC), '[]'::jsonb) INTO res
  FROM (
    SELECT jsonb_build_object(
      'keberatan_id', k.id,
      'nomor_tiket', k.nomor_tiket,
      'peserta_id', k.peserta_id,
      'nomor_urut', p.nomor_urut,
      'nama', p.nama,
      'uraian', k.uraian,
      'catatan_ip', k.catatan_ip,
      'diputus_at', k.diputus_at,
      'perbaikan_dibuka_at', k.perbaikan_dibuka_at,
      'perbaikan_selesai_at', k.perbaikan_selesai_at,
      'var_status', (SELECT v.status FROM public.var_clarification_session v
                      WHERE v.peserta_id = k.peserta_id ORDER BY v.created_at DESC LIMIT 1)
    ) AS x
    FROM public.keberatan k
    JOIN public.peserta p ON p.id = k.peserta_id
    WHERE k.status = 'diterima' AND k.tindak_lanjut = 'var'
      AND k.perbaikan_selesai_at IS NULL
  ) s;

  RETURN res;
END;
$function$;

-- === Live Ranking: hanya Admin (cabut hak Inspektur) ===
CREATE OR REPLACE FUNCTION public.inspektur_ajukan_live_ranking(_sesi integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE total int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menayangkan Live Ranking';
  END IF;

  SELECT count(*) INTO total
  FROM public.peserta p WHERE public.sesi_no_of(p.nomor_urut, p.sesi) = _sesi;

  IF total = 0 THEN RAISE EXCEPTION 'Sesi tidak ditemukan'; END IF;

  INSERT INTO public.live_ranking_sesi(sesi_no, status, requested_by, requested_at, approved_at, hidden)
  VALUES (_sesi, 'disetujui', auth.uid(), now(), now(), false)
  ON CONFLICT (sesi_no) DO UPDATE
    SET status='disetujui', requested_by=auth.uid(),
        requested_at=now(), approved_at=now(), hidden=false, updated_at=now();

  DELETE FROM public.live_ranking_vote WHERE sesi_no = _sesi;

  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_tayang', jsonb_build_object('sesi_no', _sesi));

  RETURN jsonb_build_object('sesi_no', _sesi, 'status', 'disetujui');
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_batalkan_live_ranking(_sesi integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menarik Live Ranking';
  END IF;
  UPDATE public.live_ranking_sesi
     SET status='draft', approved_at=NULL, requested_at=NULL, updated_at=now()
   WHERE sesi_no = _sesi;
  DELETE FROM public.live_ranking_vote WHERE sesi_no = _sesi;
  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_batal', jsonb_build_object('sesi_no', _sesi));
  RETURN jsonb_build_object('sesi_no', _sesi, 'status', 'draft');
END;
$function$;

CREATE OR REPLACE FUNCTION public.inspektur_set_hide_live_ranking(_sesi integer, _hidden boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengatur tampilan Live Ranking';
  END IF;
  UPDATE public.live_ranking_sesi
     SET hidden = _hidden, updated_at = now()
   WHERE sesi_no = _sesi;
  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'live_ranking_hide', jsonb_build_object('sesi_no', _sesi, 'hidden', _hidden));
  RETURN jsonb_build_object('sesi_no', _sesi, 'hidden', _hidden);
END;
$function$;

CREATE OR REPLACE FUNCTION public.live_ranking_sesi_list()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE res jsonb; jtotal bigint;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT count(*) INTO jtotal FROM public.juri WHERE approved AND role='juri' AND aktif_menilai AND NOT is_dummy;

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'sesi_no')::int), '[]'::jsonb) INTO res
  FROM (
    SELECT jsonb_build_object(
      'sesi_no', s.sesi_no,
      'total', (SELECT count(*) FROM public.peserta p WHERE public.sesi_no_of(p.nomor_urut, p.sesi) = s.sesi_no),
      'final_count', (SELECT count(*) FROM public.peserta p
                       JOIN public.penilaian_submission ps ON ps.peserta_id = p.id
                      WHERE public.sesi_no_of(p.nomor_urut, p.sesi) = s.sesi_no AND ps.nilai_cache IS NOT NULL),
      'peserta', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('nomor_urut', p.nomor_urut, 'nama', p.nama, 'final',
          EXISTS (SELECT 1 FROM public.penilaian_submission ps WHERE ps.peserta_id = p.id AND ps.nilai_cache IS NOT NULL))
        ORDER BY p.nomor_urut)
        FROM public.peserta p WHERE public.sesi_no_of(p.nomor_urut, p.sesi) = s.sesi_no
      ), '[]'::jsonb),
      'status', s.status,
      'hidden', COALESCE(s.hidden, false),
      'requested_at', s.requested_at,
      'approved_at', s.approved_at,
      'juri_total', jtotal,
      'setuju_count', (SELECT count(*) FROM public.live_ranking_vote v WHERE v.sesi_no = s.sesi_no AND v.setuju),
      'tolak_count', (SELECT count(*) FROM public.live_ranking_vote v WHERE v.sesi_no = s.sesi_no AND NOT v.setuju),
      'juri_status', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('juri_id', j.id, 'nama', j.nama, 'sudah_vote', v.id IS NOT NULL, 'setuju', v.setuju)
        ORDER BY j.nama)
        FROM public.juri j
        LEFT JOIN public.live_ranking_vote v ON v.sesi_no = s.sesi_no AND v.juri_id = j.id
        WHERE j.approved AND j.role = 'juri' AND j.aktif_menilai AND NOT j.is_dummy
      ), '[]'::jsonb)
    ) AS x
    FROM public.live_ranking_sesi s
  ) t;
  RETURN res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_live_ranking_kategori(_kategori text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengatur kategori Live Ranking';
  END IF;
  INSERT INTO public.system_config(key, value)
  VALUES ('live_ranking_kategori', to_jsonb(COALESCE(_kategori, ARRAY[]::text[])))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN to_jsonb(COALESCE(_kategori, ARRAY[]::text[]));
END;
$function$;

-- === Grants untuk fungsi baru ===
REVOKE ALL ON FUNCTION public.get_mode_inspektur() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_mode_inspektur(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_inspektur_var(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_mode_inspektur() TO anon;
GRANT EXECUTE ON FUNCTION public.get_mode_inspektur() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mode_inspektur() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_mode_inspektur(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mode_inspektur(int) TO service_role;

GRANT EXECUTE ON FUNCTION public.is_inspektur_var(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_inspektur_var(uuid) TO service_role;