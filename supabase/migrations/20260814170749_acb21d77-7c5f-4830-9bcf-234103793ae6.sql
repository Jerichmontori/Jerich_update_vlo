ALTER TABLE public.keberatan
  ADD COLUMN IF NOT EXISTS tindak_lanjut text,
  ADD COLUMN IF NOT EXISTS perbaikan_dibuka_at timestamptz,
  ADD COLUMN IF NOT EXISTS perbaikan_selesai_at timestamptz;

-- === Keputusan keberatan dengan tindak lanjut VAR ===
DROP FUNCTION IF EXISTS public.ip_putuskan_keberatan(uuid, text, text);

CREATE OR REPLACE FUNCTION public.ip_putuskan_keberatan(
  _id uuid, _keputusan text, _catatan text, _tindak_lanjut text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_peserta uuid;
  v_sid uuid;
  comps jsonb := '["clear_text","salah_kata","menambah_kata","mengurangi_kata"]'::jsonb;
  v_tl text := lower(coalesce(_tindak_lanjut,''));
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
         tindak_lanjut = CASE WHEN _keputusan = 'diterima' THEN NULLIF(v_tl,'') ELSE tindak_lanjut END,
         diputus_oleh = auth.uid(),
         diputus_at = now(),
         updated_at = now()
   WHERE id = _id
   RETURNING peserta_id INTO v_peserta;

  IF _keputusan = 'diterima' AND v_tl = 'var' AND v_peserta IS NOT NULL THEN
    SELECT id INTO v_sid FROM public.var_clarification_session
     WHERE peserta_id = v_peserta AND status <> 'final'
     ORDER BY created_at DESC LIMIT 1;

    IF v_sid IS NULL THEN
      INSERT INTO public.var_clarification_session(peserta_id, mazmur_id, status, komponen_berbeda)
      VALUES (v_peserta,
              (SELECT mazmur_id FROM public.penilaian WHERE peserta_id = v_peserta LIMIT 1),
              'keberatan_var', comps)
      RETURNING id INTO v_sid;
    ELSE
      UPDATE public.var_clarification_session
         SET status = 'keberatan_var', komponen_berbeda = comps, updated_at = now()
       WHERE id = v_sid;
    END IF;

    INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
    VALUES (auth.uid(), 'keberatan_var_perlu_perbaikan', v_peserta,
            jsonb_build_object('keberatan_id', _id, 'var_session_id', v_sid, 'catatan', _catatan));
  END IF;

  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'keberatan_diputuskan', v_peserta,
          jsonb_build_object('keberatan_id', _id, 'keputusan', _keputusan,
                             'tindak_lanjut', NULLIF(v_tl,''), 'catatan', _catatan));
END;
$function$;

-- === Notifikasi untuk Admin ===
CREATE OR REPLACE FUNCTION public.admin_notifikasi_perbaikan()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE res jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'inspektur_var')) THEN
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

-- === Buka perbaikan: hanya Inspektur VAR (atau admin) ===
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
  IF NOT (public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'admin')) THEN
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

-- === Koreksi per juri oleh Inspektur VAR ===
CREATE OR REPLACE FUNCTION public.ip2_koreksi_per_juri(_peserta uuid, _perjuri jsonb, _catatan text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  perhatian_kid uuid;
  kep_id uuid;
  sid uuid;
  nm text;
  item jsonb;
  v_juri uuid;
  v_clear boolean;
  rec record;
  d jsonb; aspek_arr jsonb; old_ayat jsonb; new_ayat jsonb; ditandai jsonb; marks jsonb;
  labels text[] := ARRAY['salah_kata','menambah_kata','mengurangi_kata'];
  i int; k int; len int; is_on boolean;
BEGIN
  IF NOT (public.has_role(auth.uid(),'inspektur_var') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF coalesce(trim(_catatan),'') = '' THEN
    RAISE EXCEPTION 'Alasan/catatan wajib diisi';
  END IF;
  IF _perjuri IS NULL OR jsonb_typeof(_perjuri) <> 'array' OR jsonb_array_length(_perjuri) = 0 THEN
    RAISE EXCEPTION 'Data koreksi juri kosong';
  END IF;

  SELECT id INTO perhatian_kid FROM public.kriteria WHERE lower(nama) LIKE '%perhatian%' LIMIT 1;
  IF perhatian_kid IS NULL THEN RAISE EXCEPTION 'Kriteria Perhatian tidak ditemukan'; END IF;

  SELECT id INTO sid FROM public.var_clarification_session
   WHERE peserta_id = _peserta ORDER BY created_at DESC LIMIT 1;
  SELECT nama INTO nm FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.var_keputusan_ip(var_session_id, peserta_id, ip_user_id, ip_nama, clear_text, koreksi, catatan)
  VALUES (sid, _peserta, auth.uid(), nm, NULL, jsonb_build_object('per_juri', _perjuri), _catatan)
  RETURNING id INTO kep_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_perjuri) LOOP
    v_juri := (item->>'juri_id')::uuid;
    v_clear := CASE WHEN jsonb_typeof(item->'clear_text') = 'boolean'
                    THEN (item->>'clear_text')::boolean ELSE NULL END;

    SELECT p.id, p.detail, j.nama AS juri_nama,
           public.hitung_nilai_juri(_peserta, p.juri_id) AS nilai_lama
      INTO rec
    FROM public.penilaian p
    JOIN public.juri j ON j.id = p.juri_id
    WHERE p.peserta_id = _peserta AND p.juri_id = v_juri AND p.kriteria_id = perhatian_kid
    LIMIT 1;

    IF rec.id IS NULL THEN CONTINUE; END IF;

    d := COALESCE(rec.detail, '{}'::jsonb);

    INSERT INTO public.var_snapshot_nilai(keputusan_id, peserta_id, juri_id, juri_nama, nilai_sebelum, detail_sebelum)
    VALUES (kep_id, _peserta, v_juri, rec.juri_nama, rec.nilai_lama, d);

    IF v_clear IS NOT NULL THEN
      d := jsonb_set(d, '{clearText}', to_jsonb(v_clear), true);
    END IF;

    aspek_arr := COALESCE(d->'aspek','[]'::jsonb);
    FOR i IN 0..2 LOOP
      IF item ? labels[i+1] AND jsonb_typeof(item->labels[i+1]) = 'array'
         AND jsonb_array_length(aspek_arr) > i THEN
        marks := item->labels[i+1];
        old_ayat := COALESCE(aspek_arr->i->'ayat','[]'::jsonb);
        len := jsonb_array_length(old_ayat);
        new_ayat := '[]'::jsonb;
        ditandai := '[]'::jsonb;
        IF len > 0 THEN
          FOR k IN 1..len LOOP
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

  UPDATE public.keberatan
     SET perbaikan_selesai_at = now(), updated_at = now()
   WHERE peserta_id = _peserta AND status = 'diterima' AND tindak_lanjut = 'var'
     AND perbaikan_selesai_at IS NULL;

  INSERT INTO public.operator_audit_log(user_id, action, peserta_id, metadata)
  VALUES (auth.uid(), 'ip2_koreksi_per_juri', _peserta,
          jsonb_build_object('keputusan_id', kep_id, 'catatan', _catatan, 'per_juri', _perjuri));

  RETURN kep_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ip_putuskan_keberatan(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_notifikasi_perbaikan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ip2_buka_perbaikan(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ip2_koreksi_per_juri(uuid, jsonb, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ip_putuskan_keberatan(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_notifikasi_perbaikan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ip2_buka_perbaikan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ip2_koreksi_per_juri(uuid, jsonb, text) TO authenticated;