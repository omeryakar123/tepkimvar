
-- Public read on all listed buckets
CREATE POLICY "public read media"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars','brand-logos','brand-covers','complaint-images','complaint-files','blog-images','banner-images'));

-- Authenticated users can upload to avatars (own folder = auth.uid())
CREATE POLICY "auth upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can upload complaint media (their uploads)
CREATE POLICY "auth upload complaint media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('complaint-images','complaint-files'));

CREATE POLICY "auth delete own complaint media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('complaint-images','complaint-files') AND owner = auth.uid());

-- Brand/admin uploads
CREATE POLICY "brand admin upload brand media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('brand-logos','brand-covers')
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.brand_members bm WHERE bm.user_id = auth.uid() AND bm.brand_id::text = (storage.foldername(name))[1])
    )
  );

CREATE POLICY "brand admin update brand media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('brand-logos','brand-covers')
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.brand_members bm WHERE bm.user_id = auth.uid() AND bm.brand_id::text = (storage.foldername(name))[1])
    )
  );

CREATE POLICY "brand admin delete brand media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('brand-logos','brand-covers')
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (SELECT 1 FROM public.brand_members bm WHERE bm.user_id = auth.uid() AND bm.brand_id::text = (storage.foldername(name))[1])
    )
  );

-- Admin-only uploads to CMS buckets
CREATE POLICY "admin upload cms media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('blog-images','banner-images')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "admin update cms media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('blog-images','banner-images')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "admin delete cms media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('blog-images','banner-images')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );
