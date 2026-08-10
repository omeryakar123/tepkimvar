
-- brand-documents (super admin read; uploader insert)
CREATE POLICY "bdocs sa read" ON storage.objects FOR SELECT
USING (bucket_id = 'brand-documents' AND (public.has_role(auth.uid(),'super_admin') OR auth.uid()::text = (storage.foldername(name))[1]));
CREATE POLICY "bdocs upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brand-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bdocs sa delete" ON storage.objects FOR DELETE
USING (bucket_id = 'brand-documents' AND (public.has_role(auth.uid(),'super_admin') OR auth.uid()::text = (storage.foldername(name))[1]));

-- brand-gallery (public read; brand member or admin write)
CREATE POLICY "bgal read" ON storage.objects FOR SELECT USING (bucket_id = 'brand-gallery');
CREATE POLICY "bgal write" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'brand-gallery' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR
    EXISTS (SELECT 1 FROM public.brand_members bm WHERE bm.user_id = auth.uid() AND bm.brand_id::text = (storage.foldername(name))[1])
  )
);
CREATE POLICY "bgal delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'brand-gallery' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR
    EXISTS (SELECT 1 FROM public.brand_members bm WHERE bm.user_id = auth.uid() AND bm.brand_id::text = (storage.foldername(name))[1])
  )
);

-- brand-videos (public read; brand member or admin write)
CREATE POLICY "bvid read" ON storage.objects FOR SELECT USING (bucket_id = 'brand-videos');
CREATE POLICY "bvid write" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'brand-videos' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR
    EXISTS (SELECT 1 FROM public.brand_members bm WHERE bm.user_id = auth.uid() AND bm.brand_id::text = (storage.foldername(name))[1])
  )
);
CREATE POLICY "bvid delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'brand-videos' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR
    EXISTS (SELECT 1 FROM public.brand_members bm WHERE bm.user_id = auth.uid() AND bm.brand_id::text = (storage.foldername(name))[1])
  )
);
