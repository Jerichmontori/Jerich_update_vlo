-- Remove broad read access
DROP POLICY IF EXISTS "authenticated read juri" ON public.juri;

-- Admin can read full rows
CREATE POLICY "admin read juri"
ON public.juri
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- A juri user can read their own row
CREATE POLICY "self read juri"
ON public.juri
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Public-safe view (no email, no user_id) for dropdowns and dashboards
CREATE OR REPLACE VIEW public.juri_public
WITH (security_invoker = off) AS
SELECT id, nama, jabatan, role, approved, bacaan_mazmur, jumlah_ayat, created_at
FROM public.juri;

GRANT SELECT ON public.juri_public TO authenticated;
GRANT SELECT ON public.juri_public TO anon;