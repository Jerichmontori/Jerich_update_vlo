
-- ============ TABEL KEBERATAN ============
CREATE TABLE public.keberatan (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nomor_tiket text NOT NULL UNIQUE,
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  jenis text NOT NULL,
  uraian text NOT NULL,
  nama_pengaju text NOT NULL,
  hubungan text,
  kontak text,
  bukti_url text,
  status text NOT NULL DEFAULT 'baru',
  keputusan text,
  catatan_ip text,
  diputus_oleh uuid,
  diputus_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.keberatan TO authenticated;
GRANT ALL ON public.keberatan TO service_role;
ALTER TABLE public.keberatan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staf dapat melihat keberatan" ON public.keberatan
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur')
  OR public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'ketua_juri')
);
CREATE POLICY "IP dapat memutuskan keberatan" ON public.keberatan
FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur_var')
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur_var')
);

CREATE TRIGGER keberatan_updated_at BEFORE UPDATE ON public.keberatan
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_keberatan_peserta ON public.keberatan(peserta_id);
CREATE INDEX idx_keberatan_status ON public.keberatan(status);

-- ============ KEPUTUSAN IP ATAS VAR ============
CREATE TABLE public.var_keputusan_ip (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  var_session_id uuid REFERENCES public.var_clarification_session(id) ON DELETE SET NULL,
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  ip_user_id uuid,
  ip_nama text,
  clear_text boolean,
  koreksi jsonb NOT NULL DEFAULT '{}'::jsonb,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.var_keputusan_ip TO authenticated;
GRANT ALL ON public.var_keputusan_ip TO service_role;
ALTER TABLE public.var_keputusan_ip ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staf dapat melihat keputusan VAR" ON public.var_keputusan_ip
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur')
  OR public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'ketua_juri')
);
CREATE INDEX idx_var_keputusan_peserta ON public.var_keputusan_ip(peserta_id);

-- ============ SNAPSHOT NILAI (APPEND ONLY) ============
CREATE TABLE public.var_snapshot_nilai (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keputusan_id uuid REFERENCES public.var_keputusan_ip(id) ON DELETE CASCADE,
  peserta_id uuid NOT NULL,
  juri_id uuid NOT NULL,
  juri_nama text,
  nilai_sebelum numeric,
  nilai_sesudah numeric,
  detail_sebelum jsonb,
  detail_sesudah jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.var_snapshot_nilai TO authenticated;
GRANT ALL ON public.var_snapshot_nilai TO service_role;
ALTER TABLE public.var_snapshot_nilai ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staf dapat melihat snapshot VAR" ON public.var_snapshot_nilai
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur')
  OR public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'ketua_juri')
);
CREATE INDEX idx_var_snapshot_keputusan ON public.var_snapshot_nilai(keputusan_id);

-- ============ PENINJAUAN KEMBALI ============
CREATE TABLE public.peninjauan_kembali (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peserta_id uuid NOT NULL REFERENCES public.peserta(id) ON DELETE CASCADE,
  pemohon_id uuid,
  pemohon_nama text,
  alasan text NOT NULL,
  status text NOT NULL DEFAULT 'menunggu',
  admin_id uuid,
  admin_nama text,
  catatan_admin text,
  diputus_at timestamptz,
  digunakan_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.peninjauan_kembali TO authenticated;
GRANT ALL ON public.peninjauan_kembali TO service_role;
ALTER TABLE public.peninjauan_kembali ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staf dapat melihat peninjauan kembali" ON public.peninjauan_kembali
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur')
  OR public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'ketua_juri')
);
CREATE TRIGGER peninjauan_updated_at BEFORE UPDATE ON public.peninjauan_kembali
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_peninjauan_peserta ON public.peninjauan_kembali(peserta_id);

-- ============ FUNGSI: CEK STATUS KEBERATAN (PUBLIK, VIA TIKET) ============
CREATE OR REPLACE FUNCTION public.keberatan_status(_tiket text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nomor_tiket', k.nomor_tiket,
    'status', k.status,
    'keputusan', k.keputusan,
    'catatan', k.catatan_ip,
    'jenis', k.jenis,
    'peserta', p.nomor_urut || '. ' || p.nama,
    'created_at', k.created_at,
    'diputus_at', k.diputus_at
  )
  FROM public.keberatan k
  JOIN public.peserta p ON p.id = k.peserta_id
  WHERE upper(k.nomor_tiket) = upper(trim(_tiket))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.keberatan_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keberatan_status(text) TO anon, authenticated;

-- ============ FUNGSI: IP2 PUTUSKAN KEBERATAN ============
CREATE OR REPLACE FUNCTION public.ip_putuskan_keberatan(_id uuid, _keputusan text, _catatan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur_var')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _keputusan NOT IN ('diterima','ditolak','ditinjau') THEN
    RAISE EXCEPTION 'Keputusan tidak valid';
  END IF;
  UPDATE public.keberatan
     SET status = CASE WHEN _keputusan = 'ditinjau' THEN 'ditinjau' ELSE _keputusan END,
         keputusan = _keputusan,
         catatan_ip = _catatan,
         diputus_oleh = auth.uid(),
         diputus_at = now()
   WHERE id = _id;
  INSERT INTO public.operator_audit_log(user_id, action, metadata)
  VALUES (auth.uid(), 'keberatan_diputuskan',
          jsonb_build_object('keberatan_id', _id, 'keputusan', _keputusan, 'catatan', _catatan));
END;
$$;
REVOKE ALL ON FUNCTION public.ip_putuskan_keberatan(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ip_putuskan_keberatan(uuid, text, text) TO authenticated;

-- ============ FUNGSI: PENINJAUAN KEMBALI ============
CREATE OR REPLACE FUNCTION public.ip2_ajukan_peninjauan(_peserta uuid, _alasan text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; nm text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur_var')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF coalesce(trim(_alasan),'') = '' THEN RAISE EXCEPTION 'Alasan wajib diisi'; END IF;
  IF EXISTS (SELECT 1 FROM public.peninjauan_kembali WHERE peserta_id=_peserta AND status='menunggu') THEN
    RAISE EXCEPTION 'Sudah ada pengajuan yang menunggu persetujuan admin';
  END IF;
  SELECT nama INTO nm FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.peninjauan_kembali(peserta_id, pemohon_id, pemohon_nama, alasan)
  VALUES (_peserta, auth.uid(), nm, _alasan) RETURNING id INTO new_id;
  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'peninjauan_diajukan', _peserta, jsonb_build_object('alasan', _alasan));
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ip2_ajukan_peninjauan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ip2_ajukan_peninjauan(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_putuskan_peninjauan(_id uuid, _setuju boolean, _catatan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; pid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT nama INTO nm FROM public.profiles WHERE id = auth.uid();
  UPDATE public.peninjauan_kembali
     SET status = CASE WHEN _setuju THEN 'disetujui' ELSE 'ditolak' END,
         admin_id = auth.uid(), admin_nama = nm, catatan_admin = _catatan, diputus_at = now()
   WHERE id = _id AND status = 'menunggu'
   RETURNING peserta_id INTO pid;
  IF pid IS NULL THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan atau sudah diputuskan'; END IF;
  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'peninjauan_diputuskan', pid,
          jsonb_build_object('setuju', _setuju, 'catatan', _catatan));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_putuskan_peninjauan(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_putuskan_peninjauan(uuid, boolean, text) TO authenticated;

-- ============ FUNGSI: IP2 PUTUSKAN VAR ============
CREATE OR REPLACE FUNCTION public.ip2_putuskan_var(_peserta uuid, _clear boolean, _koreksi jsonb, _catatan text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  perhatian_kid uuid;
  kep_id uuid;
  sid uuid;
  nm text;
  rec record;
  d jsonb; aspek_arr jsonb; old_ayat jsonb; new_ayat jsonb; ditandai jsonb;
  labels text[] := ARRAY['salah_kata','menambah_kata','mengurangi_kata'];
  i int; k int; len int; marks jsonb; is_on boolean;
  pk_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur_var')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF coalesce(trim(_catatan),'') = '' THEN RAISE EXCEPTION 'Alasan/catatan wajib diisi'; END IF;

  -- Nilai yang sudah final hanya bisa dikoreksi setelah peninjauan kembali disetujui admin
  IF public.is_peserta_final(_peserta) THEN
    SELECT id INTO pk_id FROM public.peninjauan_kembali
     WHERE peserta_id = _peserta AND status = 'disetujui' AND digunakan_at IS NULL
     ORDER BY diputus_at DESC LIMIT 1;
    IF pk_id IS NULL THEN
      RAISE EXCEPTION 'Nilai sudah final. Ajukan Peninjauan Kembali dan tunggu persetujuan admin.';
    END IF;
  END IF;

  SELECT id INTO perhatian_kid FROM public.kriteria WHERE lower(nama) LIKE '%perhatian%' LIMIT 1;
  IF perhatian_kid IS NULL THEN RAISE EXCEPTION 'Kriteria Perhatian tidak ditemukan'; END IF;

  SELECT id INTO sid FROM public.var_clarification_session
   WHERE peserta_id = _peserta ORDER BY created_at DESC LIMIT 1;
  SELECT nama INTO nm FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.var_keputusan_ip(var_session_id, peserta_id, ip_user_id, ip_nama, clear_text, koreksi, catatan)
  VALUES (sid, _peserta, auth.uid(), nm, _clear, COALESCE(_koreksi,'{}'::jsonb), _catatan)
  RETURNING id INTO kep_id;

  FOR rec IN
    SELECT p.id, p.juri_id, p.detail, j.nama AS juri_nama,
           public.hitung_nilai_juri(_peserta, p.juri_id) AS nilai_lama
    FROM public.penilaian p
    JOIN public.juri j ON j.id = p.juri_id
    WHERE p.peserta_id = _peserta AND p.kriteria_id = perhatian_kid
  LOOP
    d := COALESCE(rec.detail, '{}'::jsonb);
    INSERT INTO public.var_snapshot_nilai(keputusan_id, peserta_id, juri_id, juri_nama, nilai_sebelum, detail_sebelum)
    VALUES (kep_id, _peserta, rec.juri_id, rec.juri_nama, rec.nilai_lama, d);

    IF _clear IS NOT NULL THEN
      d := jsonb_set(d, '{clearText}', to_jsonb(_clear), true);
    END IF;

    aspek_arr := COALESCE(d->'aspek','[]'::jsonb);
    FOR i IN 0..2 LOOP
      IF _koreksi ? labels[i+1] AND jsonb_typeof(_koreksi->labels[i+1]) = 'array'
         AND jsonb_array_length(aspek_arr) > i THEN
        marks := _koreksi->labels[i+1];
        old_ayat := COALESCE(aspek_arr->i->'ayat','[]'::jsonb);
        len := jsonb_array_length(old_ayat);
        new_ayat := '[]'::jsonb;
        ditandai := '[]'::jsonb;
        IF len > 0 THEN
          FOR k IN 0..(len-1) LOOP
            is_on := marks @> to_jsonb(k);
            new_ayat := new_ayat || to_jsonb(is_on);
            IF is_on THEN ditandai := ditandai || to_jsonb(k); END IF;
          END LOOP;
          aspek_arr := jsonb_set(aspek_arr, ARRAY[i::text,'ayat'], new_ayat, true);
          aspek_arr := jsonb_set(aspek_arr, ARRAY[i::text,'ditandai'], ditandai, true);
        END IF;
      END IF;
    END LOOP;
    d := jsonb_set(d, '{aspek}', aspek_arr, true);

    UPDATE public.penilaian SET detail = d WHERE id = rec.id;
  END LOOP;

  -- segarkan cache nilai peserta ini
  UPDATE public.penilaian_submission ps
     SET nilai_cache = public.hitung_nilai_juri(ps.peserta_id, ps.juri_id)
   WHERE ps.peserta_id = _peserta;

  UPDATE public.var_snapshot_nilai s
     SET nilai_sesudah = public.hitung_nilai_juri(_peserta, s.juri_id),
         detail_sesudah = (SELECT p.detail FROM public.penilaian p
                            WHERE p.peserta_id = _peserta AND p.juri_id = s.juri_id
                              AND p.kriteria_id = perhatian_kid LIMIT 1)
   WHERE s.keputusan_id = kep_id;

  UPDATE public.var_clarification_session
     SET status = 'final', finalized_at = now(), updated_at = now()
   WHERE peserta_id = _peserta AND status <> 'final';

  IF pk_id IS NOT NULL THEN
    UPDATE public.peninjauan_kembali SET digunakan_at = now() WHERE id = pk_id;
  END IF;

  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'ip2_putuskan_var', _peserta,
          jsonb_build_object('keputusan_id', kep_id, 'clear_text', _clear,
                             'koreksi', _koreksi, 'catatan', _catatan));

  RETURN kep_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ip2_putuskan_var(uuid, boolean, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ip2_putuskan_var(uuid, boolean, jsonb, text) TO authenticated;

-- ============ FUNGSI: BERITA ACARA VAR ============
CREATE OR REPLACE FUNCTION public.var_berita_acara(_peserta uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur')
          OR public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'ketua_juri')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'peserta', (SELECT jsonb_build_object('id', p.id, 'nomor_urut', p.nomor_urut, 'nama', p.nama,
                                          'asal', p.asal, 'kategori', p.kategori)
                  FROM public.peserta p WHERE p.id = _peserta),
    'bacaan', (SELECT m.bacaan FROM public.var_clarification_session v
                 LEFT JOIN public.mazmur m ON m.id = v.mazmur_id
                WHERE v.peserta_id = _peserta ORDER BY v.created_at DESC LIMIT 1),
    'var', (SELECT jsonb_build_object('id', v.id, 'status', v.status,
                                      'komponen_berbeda', v.komponen_berbeda,
                                      'created_at', v.created_at, 'finalized_at', v.finalized_at)
              FROM public.var_clarification_session v
             WHERE v.peserta_id = _peserta ORDER BY v.created_at DESC LIMIT 1),
    'keputusan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', kp.id, 'ip_nama', kp.ip_nama, 'clear_text', kp.clear_text,
        'koreksi', kp.koreksi, 'catatan', kp.catatan, 'created_at', kp.created_at,
        'snapshot', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'juri_nama', s.juri_nama, 'nilai_sebelum', s.nilai_sebelum, 'nilai_sesudah', s.nilai_sesudah
          ) ORDER BY s.juri_nama)
          FROM public.var_snapshot_nilai s WHERE s.keputusan_id = kp.id), '[]'::jsonb)
      ) ORDER BY kp.created_at)
      FROM public.var_keputusan_ip kp WHERE kp.peserta_id = _peserta), '[]'::jsonb),
    'peninjauan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'alasan', pk.alasan, 'pemohon', pk.pemohon_nama, 'status', pk.status,
        'admin', pk.admin_nama, 'catatan_admin', pk.catatan_admin,
        'created_at', pk.created_at, 'diputus_at', pk.diputus_at) ORDER BY pk.created_at)
      FROM public.peninjauan_kembali pk WHERE pk.peserta_id = _peserta), '[]'::jsonb),
    'keberatan', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'nomor_tiket', kb.nomor_tiket, 'jenis', kb.jenis, 'uraian', kb.uraian,
        'nama_pengaju', kb.nama_pengaju, 'status', kb.status, 'keputusan', kb.keputusan,
        'catatan_ip', kb.catatan_ip, 'created_at', kb.created_at) ORDER BY kb.created_at)
      FROM public.keberatan kb WHERE kb.peserta_id = _peserta), '[]'::jsonb),
    'nilai_akhir', public.hitung_nilai_akhir(_peserta)
  ) INTO res;

  RETURN res;
END;
$$;
REVOKE ALL ON FUNCTION public.var_berita_acara(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.var_berita_acara(uuid) TO authenticated;
