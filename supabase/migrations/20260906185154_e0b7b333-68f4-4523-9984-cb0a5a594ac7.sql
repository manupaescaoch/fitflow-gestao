CREATE POLICY "form uploads publicos" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'formularios');
CREATE POLICY "form arquivos leitura crm" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'formularios' AND public.is_crm_user(auth.uid()));
CREATE POLICY "form arquivos update crm" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'formularios' AND public.is_crm_user(auth.uid()));
CREATE POLICY "form arquivos delete crm" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'formularios' AND public.is_crm_user(auth.uid()));