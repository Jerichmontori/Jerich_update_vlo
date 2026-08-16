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
  labels text[] := ARRAY['salah_kata','menambah_kata','mengurangi_kata','mengulang_kata'];
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
    FOR i IN 0..3 LOOP
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

  INSERT INTO public.operator_audit_log(user_id, user_nama, role, action, peserta_id, metadata)
  VALUES (auth.uid(), nm, 'inspektur_var', 'var_koreksi_per_juri', _peserta,
          jsonb_build_object('keputusan_id', kep_id));

  RETURN kep_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ip2_koreksi_per_juri(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ip2_koreksi_per_juri(uuid, jsonb, text) TO authenticated, service_role;