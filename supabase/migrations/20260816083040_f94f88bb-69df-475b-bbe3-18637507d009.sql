
CREATE TABLE IF NOT EXISTS public.perbaikan_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  dibuka_oleh uuid,
  dibuka_nama text,
  alasan text,
  jenis text NOT NULL DEFAULT 'admin_bebas',
  juri_id uuid,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'aktif',
  dibuka_at timestamptz NOT NULL DEFAULT now(),
  ditutup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.perbaikan_snapshot TO authenticated;
GRANT ALL ON public.perbaikan_snapshot TO service_role;

ALTER TABLE public.perbaikan_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_inspektur_read_snapshot" ON public.perbaikan_snapshot;
CREATE POLICY "admin_inspektur_read_snapshot" ON public.perbaikan_snapshot
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'inspektur')
    OR public.has_role(auth.uid(),'inspektur_var')
  );

DROP TRIGGER IF EXISTS trg_perbaikan_snapshot_updated ON public.perbaikan_snapshot;
CREATE TRIGGER trg_perbaikan_snapshot_updated
  BEFORE UPDATE ON public.perbaikan_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_perbaikan_snapshot_peserta ON public.perbaikan_snapshot(peserta_id, status);

-- Helper: apakah peserta sedang ditangani VAR akibat keberatan
CREATE OR REPLACE FUNCTION public.perbaikan_var_aktif(_peserta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.keberatan k
    WHERE k.peserta_id = _peserta AND k.status = 'diterima'
      AND k.tindak_lanjut = 'var' AND k.perbaikan_selesai_at IS NULL
  );
$$;

-- Helper: apakah ada perbaikan jalur juri yang masih berjalan
CREATE OR REPLACE FUNCTION public.perbaikan_juri_aktif(_peserta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perbaikan_snapshot s
    WHERE s.peserta_id = _peserta AND s.status = 'aktif'
  ) OR EXISTS (
    SELECT 1 FROM public.peninjauan_kembali pk
    WHERE pk.peserta_id = _peserta AND pk.status = 'menunggu_perbaikan_juri'
  );
$$;

-- Simpan cadangan kiriman juri
CREATE OR REPLACE FUNCTION public.buat_perbaikan_snapshot(_peserta uuid, _juri uuid, _jenis text, _alasan text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_data jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'juri_id', ps.juri_id,
           'nilai_cache', ps.nilai_cache,
           'created_at', ps.created_at)), '[]'::jsonb)
    INTO v_data
  FROM public.penilaian_submission ps
  WHERE ps.peserta_id = _peserta AND (_juri IS NULL OR ps.juri_id = _juri);

  INSERT INTO public.perbaikan_snapshot(peserta_id, dibuka_oleh, dibuka_nama, alasan, jenis, juri_id, data)
  VALUES (_peserta, auth.uid(), (SELECT nama FROM public.profiles WHERE id = auth.uid()),
          _alasan, COALESCE(_jenis,'admin_bebas'), _juri, v_data)
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$;

-- JALUR 1: juri mengajukan permintaan perbaikan
CREATE OR REPLACE FUNCTION public.juri_ajukan_perbaikan(_peserta uuid, _alasan text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_juri uuid; v_id uuid;
BEGIN
  IF NOT public.has_role(v_uid,'juri') THEN
    RAISE EXCEPTION 'Hanya juri yang dapat mengajukan perbaikan';
  END IF;
  IF _alasan IS NULL OR btrim(_alasan) = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi';
  END IF;

  SELECT juri_id INTO v_juri FROM public.profiles WHERE id = v_uid;
  IF v_juri IS NULL THEN RAISE EXCEPTION 'Akun juri belum terhubung'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.penilaian_submission
                  WHERE peserta_id = _peserta AND juri_id = v_juri) THEN
    RAISE EXCEPTION 'Anda belum mengirim penilaian untuk peserta ini';
  END IF;

  IF public.perbaikan_var_aktif(_peserta) THEN
    RAISE EXCEPTION 'Peserta sedang dalam penanganan VAR Inspektur Pertandingan';
  END IF;

  IF EXISTS (SELECT 1 FROM public.peninjauan_kembali
              WHERE peserta_id = _peserta AND pemohon_id = v_juri
                AND status = 'menunggu_perbaikan_juri') THEN
    RAISE EXCEPTION 'Permintaan perbaikan Anda masih menunggu keputusan admin';
  END IF;

  INSERT INTO public.peninjauan_kembali(peserta_id, pemohon_id, pemohon_nama, alasan, status)
  VALUES (_peserta, v_juri, (SELECT nama FROM public.juri WHERE id = v_juri),
          _alasan, 'menunggu_perbaikan_juri')
  RETURNING id INTO v_id;

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid), 'juri',
          'juri_ajukan_perbaikan', _peserta, jsonb_build_object('alasan', _alasan, 'request_id', v_id));

  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.juri_permintaan_perbaikan_saya()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb; v_juri uuid;
BEGIN
  SELECT juri_id INTO v_juri FROM public.profiles WHERE id = auth.uid();
  IF v_juri IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pk.id, 'peserta_id', pk.peserta_id, 'nomor_urut', p.nomor_urut,
    'nama', p.nama, 'alasan', pk.alasan, 'status', pk.status,
    'catatan_admin', pk.catatan_admin, 'created_at', pk.created_at,
    'diputus_at', pk.diputus_at) ORDER BY pk.created_at DESC), '[]'::jsonb)
  INTO res
  FROM public.peninjauan_kembali pk
  JOIN public.peserta p ON p.id = pk.peserta_id
  WHERE pk.pemohon_id = v_juri
    AND pk.status IN ('menunggu_perbaikan_juri','disetujui_perbaikan_juri','ditolak_perbaikan_juri');

  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_permintaan_perbaikan()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pk.id, 'peserta_id', pk.peserta_id, 'nomor_urut', p.nomor_urut,
    'peserta_nama', p.nama, 'juri_id', pk.pemohon_id, 'juri_nama', pk.pemohon_nama,
    'alasan', pk.alasan, 'created_at', pk.created_at,
    'var_aktif', public.perbaikan_var_aktif(pk.peserta_id)
  ) ORDER BY pk.created_at ASC), '[]'::jsonb)
  INTO res
  FROM public.peninjauan_kembali pk
  JOIN public.peserta p ON p.id = pk.peserta_id
  WHERE pk.status = 'menunggu_perbaikan_juri';

  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_putuskan_perbaikan_juri(_id uuid, _setuju boolean, _catatan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.peninjauan_kembali%ROWTYPE;
  v_sesi uuid; v_snap uuid;
BEGIN
  IF NOT public.has_role(v_uid,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_row FROM public.peninjauan_kembali
   WHERE id = _id AND status = 'menunggu_perbaikan_juri';
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan tidak ditemukan atau sudah diputus'; END IF;

  IF _setuju THEN
    IF public.perbaikan_var_aktif(v_row.peserta_id) THEN
      RAISE EXCEPTION 'Peserta sedang dalam penanganan VAR Inspektur Pertandingan';
    END IF;

    v_snap := public.buat_perbaikan_snapshot(v_row.peserta_id, v_row.pemohon_id,
                'permintaan_juri', COALESCE(_catatan, v_row.alasan));

    DELETE FROM public.penilaian_submission
     WHERE peserta_id = v_row.peserta_id AND juri_id = v_row.pemohon_id;

    SELECT id INTO v_sesi FROM public.sesi_penilaian
     WHERE peserta_id = v_row.peserta_id ORDER BY started_at DESC LIMIT 1;

    IF v_sesi IS NULL THEN
      INSERT INTO public.sesi_penilaian(peserta_id, mazmur_id, status, created_by)
      VALUES (v_row.peserta_id, NULL, 'active', v_uid) RETURNING id INTO v_sesi;
    ELSE
      UPDATE public.sesi_penilaian SET status='active', ended_at=NULL, updated_at=now()
       WHERE id = v_sesi;
    END IF;
  END IF;

  UPDATE public.peninjauan_kembali
     SET status = CASE WHEN _setuju THEN 'disetujui_perbaikan_juri' ELSE 'ditolak_perbaikan_juri' END,
         admin_id = v_uid,
         admin_nama = (SELECT nama FROM public.profiles WHERE id=v_uid),
         catatan_admin = _catatan,
         diputus_at = now(), updated_at = now()
   WHERE id = _id;

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, session_id, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid), 'admin',
          'admin_putuskan_perbaikan_juri', v_sesi, v_row.peserta_id,
          jsonb_build_object('request_id', _id, 'setuju', _setuju, 'catatan', _catatan, 'snapshot_id', v_snap));

  RETURN jsonb_build_object('ok', true, 'snapshot_id', v_snap);
END; $$;

-- Buka penilaian ulang (admin) dengan penjagaan + cadangan
CREATE OR REPLACE FUNCTION public.admin_buka_penilaian_ulang(_peserta uuid, _catatan text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sesi uuid; v_snap uuid;
BEGIN
  IF NOT public.has_role(v_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF _catatan IS NULL OR btrim(_catatan) = '' THEN
    RAISE EXCEPTION 'Alasan buka perbaikan wajib diisi';
  END IF;
  IF public.perbaikan_var_aktif(_peserta) THEN
    RAISE EXCEPTION 'Peserta sedang dalam penanganan VAR Inspektur Pertandingan';
  END IF;

  v_snap := public.buat_perbaikan_snapshot(_peserta, NULL, 'admin_bebas', _catatan);

  UPDATE public.var_clarification_session
     SET status='final', komponen_berbeda='[]'::jsonb,
         finalized_at=COALESCE(finalized_at, now()), updated_at=now()
   WHERE peserta_id = _peserta AND status <> 'final';

  DELETE FROM public.penilaian_submission WHERE peserta_id = _peserta;

  SELECT id INTO v_sesi FROM public.sesi_penilaian
   WHERE peserta_id = _peserta ORDER BY started_at DESC LIMIT 1;

  IF v_sesi IS NULL THEN
    INSERT INTO public.sesi_penilaian(peserta_id, mazmur_id, status, created_by)
    VALUES (_peserta, NULL, 'active', v_uid) RETURNING id INTO v_sesi;
  ELSE
    UPDATE public.sesi_penilaian SET status='active', ended_at=NULL, updated_at=now()
     WHERE id = v_sesi;
  END IF;

  UPDATE public.peserta SET terlambat=false, terlambat_at=NULL WHERE id=_peserta;

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, session_id, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid), 'admin',
          'admin_buka_penilaian_ulang', v_sesi, _peserta,
          jsonb_build_object('catatan', _catatan, 'snapshot_id', v_snap));

  RETURN v_sesi;
END; $$;

-- Status perbaikan aktif untuk peserta (untuk tombol batal)
CREATE OR REPLACE FUNCTION public.perbaikan_aktif_list()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur')
          OR public.has_role(auth.uid(),'inspektur_var')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'peserta_id', s.peserta_id, 'nomor_urut', p.nomor_urut, 'peserta_nama', p.nama,
    'jenis', s.jenis, 'juri_id', s.juri_id, 'alasan', s.alasan,
    'dibuka_nama', s.dibuka_nama, 'dibuka_at', s.dibuka_at,
    'jumlah_cadangan', jsonb_array_length(s.data),
    'ada_nilai_baru', EXISTS (
        SELECT 1 FROM public.penilaian_submission ps
        WHERE ps.peserta_id = s.peserta_id
          AND (s.juri_id IS NULL OR ps.juri_id = s.juri_id)
          AND ps.created_at >= s.dibuka_at)
  ) ORDER BY s.dibuka_at DESC), '[]'::jsonb)
  INTO res
  FROM public.perbaikan_snapshot s
  JOIN public.peserta p ON p.id = s.peserta_id
  WHERE s.status = 'aktif';

  RETURN res;
END; $$;

-- Pemulihan bersama (dipakai batal & pulihkan)
CREATE OR REPLACE FUNCTION public.pulihkan_dari_snapshot(_snap uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.perbaikan_snapshot%ROWTYPE;
  it jsonb; n int := 0; v_start timestamptz := now();
BEGIN
  SELECT * INTO s FROM public.perbaikan_snapshot WHERE id = _snap;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadangan tidak ditemukan'; END IF;

  DELETE FROM public.penilaian_submission
   WHERE peserta_id = s.peserta_id AND (s.juri_id IS NULL OR juri_id = s.juri_id);

  FOR it IN SELECT * FROM jsonb_array_elements(s.data) LOOP
    INSERT INTO public.penilaian_submission(peserta_id, juri_id, nilai_cache, created_at)
    VALUES (s.peserta_id, (it->>'juri_id')::uuid,
            NULLIF(it->>'nilai_cache','')::numeric,
            COALESCE((it->>'created_at')::timestamptz, now()))
    ON CONFLICT DO NOTHING;
    n := n + 1;
  END LOOP;

  -- tutup sesi VAR yang muncul akibat pemulihan
  UPDATE public.var_clarification_session
     SET status='final', komponen_berbeda='[]'::jsonb,
         finalized_at=COALESCE(finalized_at, now()), updated_at=now()
   WHERE peserta_id = s.peserta_id AND status <> 'final' AND created_at >= v_start;

  UPDATE public.sesi_penilaian
     SET status='selesai', ended_at=COALESCE(ended_at, now()), updated_at=now()
   WHERE peserta_id = s.peserta_id AND status = 'active';

  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_batal_buka_perbaikan(_peserta uuid, _alasan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  s public.perbaikan_snapshot%ROWTYPE;
  v_baru boolean; n int;
BEGIN
  IF NOT public.has_role(v_uid,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO s FROM public.perbaikan_snapshot
   WHERE peserta_id = _peserta AND status = 'aktif'
   ORDER BY dibuka_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tidak ada perbaikan aktif untuk peserta ini'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.penilaian_submission ps
    WHERE ps.peserta_id = _peserta AND (s.juri_id IS NULL OR ps.juri_id = s.juri_id)
      AND ps.created_at >= s.dibuka_at) INTO v_baru;

  IF v_baru THEN
    RAISE EXCEPTION 'Sudah ada nilai baru yang masuk. Ajukan pemulihan ke Inspektur Pertandingan';
  END IF;

  n := public.pulihkan_dari_snapshot(s.id);

  UPDATE public.perbaikan_snapshot
     SET status='dibatalkan', ditutup_at=now(), updated_at=now() WHERE id = s.id;

  UPDATE public.peninjauan_kembali
     SET status='dibatalkan_admin', catatan_admin=COALESCE(_alasan, catatan_admin), updated_at=now()
   WHERE peserta_id = _peserta AND status = 'disetujui_perbaikan_juri' AND digunakan_at IS NULL;

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid), 'admin',
          'admin_batal_buka_perbaikan', _peserta,
          jsonb_build_object('snapshot_id', s.id, 'alasan', _alasan, 'dipulihkan', n));

  RETURN jsonb_build_object('ok', true, 'dipulihkan', n);
END; $$;

CREATE OR REPLACE FUNCTION public.ip2_pulihkan_nilai(_peserta uuid, _catatan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  s public.perbaikan_snapshot%ROWTYPE;
  r record; it jsonb; n int;
BEGIN
  IF NOT (public.has_role(v_uid,'inspektur') OR public.has_role(v_uid,'inspektur_var')) THEN
    RAISE EXCEPTION 'Hanya Inspektur Pertandingan yang dapat memulihkan nilai';
  END IF;

  SELECT * INTO s FROM public.perbaikan_snapshot
   WHERE peserta_id = _peserta AND status = 'aktif'
   ORDER BY dibuka_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tidak ada perbaikan aktif untuk peserta ini'; END IF;

  -- catat perbandingan sebelum/sesudah
  FOR it IN SELECT * FROM jsonb_array_elements(s.data) LOOP
    INSERT INTO public.var_snapshot_nilai(peserta_id, juri_id, juri_nama, nilai_sebelum, nilai_sesudah)
    SELECT _peserta, (it->>'juri_id')::uuid,
           (SELECT nama FROM public.juri WHERE id = (it->>'juri_id')::uuid),
           (SELECT ps.nilai_cache FROM public.penilaian_submission ps
             WHERE ps.peserta_id=_peserta AND ps.juri_id=(it->>'juri_id')::uuid),
           NULLIF(it->>'nilai_cache','')::numeric;
  END LOOP;

  n := public.pulihkan_dari_snapshot(s.id);

  UPDATE public.perbaikan_snapshot
     SET status='dipulihkan_inspektur', ditutup_at=now(), updated_at=now() WHERE id = s.id;

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, peserta_id, metadata)
  VALUES (v_uid, (SELECT nama FROM public.profiles WHERE id=v_uid), 'inspektur',
          'ip2_pulihkan_nilai', _peserta,
          jsonb_build_object('snapshot_id', s.id, 'catatan', _catatan, 'dipulihkan', n));

  RETURN jsonb_build_object('ok', true, 'dipulihkan', n);
END; $$;

-- Tandai perbaikan selesai saat semua juri sudah mengirim ulang
CREATE OR REPLACE FUNCTION public.tutup_perbaikan_jika_selesai()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.perbaikan_snapshot s
     SET status='selesai', ditutup_at=now(), updated_at=now()
   WHERE s.peserta_id = NEW.peserta_id AND s.status='aktif'
     AND (s.juri_id IS NULL OR s.juri_id = NEW.juri_id)
     AND public.all_juri_submitted(NEW.peserta_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_tutup_perbaikan ON public.penilaian_submission;
CREATE TRIGGER trg_tutup_perbaikan
  AFTER INSERT ON public.penilaian_submission
  FOR EACH ROW EXECUTE FUNCTION public.tutup_perbaikan_jika_selesai();

-- JALUR 2: buka perbaikan VAR hanya untuk Inspektur VAR
CREATE OR REPLACE FUNCTION public.ip2_buka_perbaikan(_peserta uuid, _catatan text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sid uuid;
  comps jsonb := '["clear_text","salah_kata","menambah_kata","mengurangi_kata"]'::jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'inspektur')) THEN
    RAISE EXCEPTION 'Hanya Inspektur VAR yang dapat membuka perbaikan';
  END IF;

  IF public.perbaikan_juri_aktif(_peserta) THEN
    RAISE EXCEPTION 'Masih ada perbaikan penilaian juri yang berjalan untuk peserta ini';
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
END; $$;

REVOKE ALL ON FUNCTION public.perbaikan_var_aktif(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.perbaikan_juri_aktif(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buat_perbaikan_snapshot(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pulihkan_dari_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.juri_ajukan_perbaikan(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.juri_permintaan_perbaikan_saya() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_permintaan_perbaikan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_putuskan_perbaikan_juri(uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_batal_buka_perbaikan(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ip2_pulihkan_nilai(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.perbaikan_aktif_list() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.perbaikan_var_aktif(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perbaikan_juri_aktif(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.juri_ajukan_perbaikan(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.juri_permintaan_perbaikan_saya() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_permintaan_perbaikan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_putuskan_perbaikan_juri(uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_batal_buka_perbaikan(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ip2_pulihkan_nilai(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perbaikan_aktif_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.buat_perbaikan_snapshot(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pulihkan_dari_snapshot(uuid) TO service_role;
