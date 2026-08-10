
-- Complaint media (folder ownership already enforced from previous migration)
DROP POLICY IF EXISTS "auth upload complaint media" ON storage.objects;
CREATE POLICY "auth upload complaint images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'complaint-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND coalesce((metadata->>'size')::bigint, 0) <= 10485760
  AND coalesce(metadata->>'mimetype','') IN ('image/jpeg','image/png','image/webp','image/gif','image/avif')
);

CREATE POLICY "auth upload complaint files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'complaint-files'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND coalesce((metadata->>'size')::bigint, 0) <= 20971520
  AND coalesce(metadata->>'mimetype','') IN (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv',
    'image/jpeg','image/png','image/webp'
  )
);

-- Avatars
DROP POLICY IF EXISTS "auth upload own avatar" ON storage.objects;
CREATE POLICY "auth upload own avatar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND coalesce((metadata->>'size')::bigint, 0) <= 5242880
  AND coalesce(metadata->>'mimetype','') IN ('image/jpeg','image/png','image/webp','image/avif')
);
