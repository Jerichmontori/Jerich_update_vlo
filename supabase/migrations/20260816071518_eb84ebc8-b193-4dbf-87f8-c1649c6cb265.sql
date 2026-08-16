DROP POLICY IF EXISTS "admin_read_export_bucket" ON storage.objects;
DROP POLICY IF EXISTS "admin_insert_export_bucket" ON storage.objects;
DROP POLICY IF EXISTS "admin_update_export_bucket" ON storage.objects;
DROP POLICY IF EXISTS "admin_delete_export_bucket" ON storage.objects;

CREATE POLICY "admin_read_export_bucket" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'database_export_13_08_26' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_export_bucket" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'database_export_13_08_26' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_export_bucket" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'database_export_13_08_26' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'database_export_13_08_26' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_export_bucket" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'database_export_13_08_26' AND public.has_role(auth.uid(), 'admin'));