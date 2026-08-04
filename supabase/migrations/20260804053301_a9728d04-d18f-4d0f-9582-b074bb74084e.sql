CREATE OR REPLACE FUNCTION public.prevent_profile_juri_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.juri_id IS DISTINCT FROM OLD.juri_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Tidak diizinkan mengubah keterkaitan juri pada profil';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Tidak diizinkan mengubah id profil';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_juri_id_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_juri_id_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_juri_id_change();