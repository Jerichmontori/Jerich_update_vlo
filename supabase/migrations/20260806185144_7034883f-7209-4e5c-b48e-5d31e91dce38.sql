CREATE OR REPLACE FUNCTION public.enforce_penilaian_lengkap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total int;
  _isi int;
  _kosong text;
BEGIN
  SELECT count(*) INTO _total FROM public.kriteria;
  SELECT count(DISTINCT p.kriteria_id) INTO _isi
    FROM public.penilaian p
   WHERE p.juri_id = NEW.juri_id AND p.peserta_id = NEW.peserta_id;

  IF _total > 0 AND _isi < _total THEN
    SELECT string_agg(k.nama, ', ') INTO _kosong
      FROM public.kriteria k
     WHERE NOT EXISTS (
       SELECT 1 FROM public.penilaian p
        WHERE p.juri_id = NEW.juri_id
          AND p.peserta_id = NEW.peserta_id
          AND p.kriteria_id = k.id
     );
    RAISE EXCEPTION 'Penilaian belum lengkap. Item kosong: %', COALESCE(_kosong, '-');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_penilaian_lengkap ON public.penilaian_submission;
CREATE TRIGGER trg_enforce_penilaian_lengkap
BEFORE INSERT OR UPDATE ON public.penilaian_submission
FOR EACH ROW EXECUTE FUNCTION public.enforce_penilaian_lengkap();