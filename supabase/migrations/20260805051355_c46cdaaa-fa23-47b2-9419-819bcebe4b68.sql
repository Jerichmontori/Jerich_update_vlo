CREATE OR REPLACE FUNCTION public.viewer_catatan_peserta(_peserta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT public.is_peserta_final(_peserta) THEN
    RAISE EXCEPTION 'Peserta belum selesai dinilai';
  END IF;

  SELECT jsonb_build_object(
    'peserta', (SELECT jsonb_build_object('nomor_urut', p.nomor_urut, 'nama', p.nama, 'asal', p.asal, 'kategori', p.kategori)
                FROM public.peserta p WHERE p.id = _peserta),
    'bacaan', (SELECT m.bacaan FROM public.sesi_penilaian s LEFT JOIN public.mazmur m ON m.id = s.mazmur_id
               WHERE s.peserta_id = _peserta ORDER BY s.started_at DESC LIMIT 1),
    'catatan', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'juri_nama', j.nama, 'catatan', mj.catatan
      ) ORDER BY j.nama), '[]'::jsonb)
      FROM public.masukan_juri mj
      LEFT JOIN public.juri j ON j.id = mj.juri_id
      WHERE mj.peserta_id = _peserta
    ),
    'juri', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x->>'juri_nama'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'juri_id', j.id,
          'juri_nama', j.nama,
          'nilai_juri', public.hitung_nilai_juri(_peserta, j.id),
          'penilaian', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('kriteria', k.nama, 'nilai', pn.nilai) ORDER BY k.nama), '[]'::jsonb)
            FROM public.penilaian pn
            JOIN public.kriteria k ON k.id = pn.kriteria_id
            WHERE pn.peserta_id = _peserta AND pn.juri_id = j.id
          ),
          'catatan', (
            SELECT mj.catatan FROM public.masukan_juri mj
            WHERE mj.peserta_id = _peserta AND mj.juri_id = j.id LIMIT 1
          )
        ) AS x
        FROM public.juri j
        WHERE EXISTS (SELECT 1 FROM public.penilaian pn WHERE pn.peserta_id = _peserta AND pn.juri_id = j.id)
      ) s
    ),
    'nilai_akhir', public.hitung_nilai_akhir(_peserta)
  ) INTO res;

  RETURN res;
END;
$function$;