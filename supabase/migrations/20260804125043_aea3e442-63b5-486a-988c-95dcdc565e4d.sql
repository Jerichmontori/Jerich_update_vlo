DROP POLICY IF EXISTS "update own profile" ON public.profiles;

CREATE POLICY "update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND juri_id IS NOT DISTINCT FROM (
    SELECT p.juri_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);