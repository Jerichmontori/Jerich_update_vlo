ALTER TABLE public.penilaian_submission ADD COLUMN IF NOT EXISTS nilai_cache numeric;

CREATE OR REPLACE FUNCTION public.trg_submission_cache()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.nilai_cache := public.hitung_nilai_juri(NEW.peserta_id, NEW.juri_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_cache ON public.penilaian_submission;
CREATE TRIGGER trg_submission_cache
BEFORE INSERT OR UPDATE ON public.penilaian_submission
FOR EACH ROW EXECUTE FUNCTION public.trg_submission_cache();

CREATE OR REPLACE FUNCTION public.trg_penilaian_cache()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p uuid; _j uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN _p := OLD.peserta_id; _j := OLD.juri_id;
  ELSE _p := NEW.peserta_id; _j := NEW.juri_id; END IF;
  UPDATE public.penilaian_submission ps
     SET nilai_cache = public.hitung_nilai_juri(_p, _j)
   WHERE ps.peserta_id = _p AND ps.juri_id = _j;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_penilaian_cache ON public.penilaian;
CREATE TRIGGER trg_penilaian_cache
AFTER INSERT OR UPDATE OR DELETE ON public.penilaian
FOR EACH ROW EXECUTE FUNCTION public.trg_penilaian_cache();

CREATE OR REPLACE FUNCTION public.refresh_nilai_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.penilaian_submission ps
     SET nilai_cache = public.hitung_nilai_juri(ps.peserta_id, ps.juri_id);
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_nilai_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_nilai_cache() TO authenticated, service_role;

UPDATE public.penilaian_submission ps
   SET nilai_cache = public.hitung_nilai_juri(ps.peserta_id, ps.juri_id);

CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(peserta_id uuid, nomor_urut integer, nama text, asal text, total_skor numeric, rata_rata numeric, jumlah_juri bigint, nilai_akhir numeric, var_status text, juri_total_sum numeric, juri_spread numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT ps.peserta_id AS pid,
           SUM(ps.nilai_cache) AS juri_total_sum,
           (COALESCE(MAX(ps.nilai_cache),0) - COALESCE(MIN(ps.nilai_cache),0)) AS juri_spread,
           AVG(ps.nilai_cache) AS juri_avg,
           COUNT(*)::bigint AS jumlah_juri
    FROM public.penilaian_submission ps
    WHERE ps.nilai_cache IS NOT NULL
    GROUP BY ps.peserta_id
  ),
  base AS (
    SELECT p.id AS pid, p.nomor_urut, p.nama, p.asal, p.terlambat, p.kategori,
           COALESCE(a.juri_total_sum,0)::numeric AS juri_total_sum,
           COALESCE(a.juri_spread,0)::numeric AS juri_spread,
           COALESCE(a.jumlah_juri,0)::bigint AS jumlah_juri,
           a.juri_avg,
           (SELECT k.batas_bawah FROM public.kategori k
              WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(p.kategori,'')))
              ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST LIMIT 1) AS bb,
           (SELECT k.batas_atas FROM public.kategori k
              WHERE lower(trim(COALESCE(NULLIF(k.kriteria_peserta,''), NULLIF(k.kategori,''), ''))) = lower(trim(COALESCE(p.kategori,'')))
              ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC NULLS LAST LIMIT 1) AS ba
    FROM public.peserta p
    LEFT JOIN agg a ON a.pid = p.id
  ),
  calc AS (
    SELECT b.*, CASE
        WHEN COALESCE(b.terlambat,false) THEN 1::numeric
        WHEN b.juri_avg IS NULL THEN NULL
        ELSE round(GREATEST(COALESCE(b.bb,0), LEAST(COALESCE(b.ba,100), b.juri_avg)), 3)
      END AS na
    FROM base b
  )
  SELECT c.pid, c.nomor_urut, c.nama, c.asal,
         c.juri_total_sum, COALESCE(c.na,0)::numeric, c.jumlah_juri, c.na,
         (SELECT vs.status FROM public.var_clarification_session vs WHERE vs.peserta_id=c.pid AND vs.status <> 'final' LIMIT 1),
         c.juri_total_sum, c.juri_spread
  FROM calc c
  ORDER BY c.na DESC NULLS LAST, c.juri_total_sum DESC, c.juri_spread DESC, c.nomor_urut ASC;
$$;
REVOKE ALL ON FUNCTION public.get_ranking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO anon, authenticated, service_role;