UPDATE public.var_clarification_session v
   SET status = 'final',
       finalized_at = now(),
       updated_at = now()
 WHERE v.status = 'potensi_var'
   AND NOT EXISTS (
     SELECT 1 FROM public.sesi_penilaian s
      WHERE s.peserta_id = v.peserta_id AND s.status = 'active'
   );

INSERT INTO public.operator_audit_log(action, metadata)
VALUES ('var_cleanup_stale', jsonb_build_object('reason', 'finalisasi potensi_var lama tanpa sesi aktif'));