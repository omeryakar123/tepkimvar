
-- 1. brands: hide phone/email from anon
REVOKE SELECT ON public.brands FROM anon;
GRANT SELECT (
  id, slug, name, category_id, about, website, address, city,
  logo_url, cover_url, socials, business_hours, verified, premium,
  rating, total_complaints, resolution_rate, avg_response_minutes,
  created_at, updated_at, premium_until, license_no,
  seo_title, seo_description, gallery, cover_video, is_active,
  complaints_resolved, complaints_pending, rating_count,
  avg_first_response_minutes, tier
) ON public.brands TO anon;

-- 2. profiles: hide phone / verification / ban status from anon
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name, username, avatar_url, city, bio, created_at, updated_at)
  ON public.profiles TO anon;

-- 3. brand_ratings: hide user_id from anon
REVOKE SELECT ON public.brand_ratings FROM anon;
GRANT SELECT (id, brand_id, rating, created_at, updated_at)
  ON public.brand_ratings TO anon;

-- 4. complaint_history: only readable if parent complaint is visible
DROP POLICY IF EXISTS history_public_read ON public.complaint_history;
CREATE POLICY history_visible_read ON public.complaint_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_history.complaint_id
      AND (
        (c.is_public AND c.status NOT IN ('pending','rejected','spam'))
        OR auth.uid() = c.user_id
        OR public.is_brand_member(c.brand_id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

-- 5. complaint_attachments: public branch must verify parent complaint public
DROP POLICY IF EXISTS "attachments visibility read" ON public.complaint_attachments;
CREATE POLICY "attachments visibility read" ON public.complaint_attachments
FOR SELECT USING (
  CASE visibility
    WHEN 'public'::attachment_visibility THEN EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_attachments.complaint_id
        AND (
          (c.is_public AND c.status NOT IN ('pending','rejected','spam'))
          OR auth.uid() = c.user_id
          OR public.is_brand_member(c.brand_id, auth.uid())
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)
        )
    )
    WHEN 'brand_only'::attachment_visibility THEN (
      EXISTS (
        SELECT 1 FROM public.complaints c
        WHERE c.id = complaint_attachments.complaint_id
          AND (auth.uid() = c.user_id OR public.is_brand_member(c.brand_id, auth.uid()))
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
    WHEN 'super_admin_only'::attachment_visibility THEN public.has_role(auth.uid(), 'super_admin'::app_role)
    ELSE NULL::boolean
  END
);

-- 6. storage: complaint media uploads must be inside auth.uid()/ folder
DROP POLICY IF EXISTS "auth upload complaint media" ON storage.objects;
CREATE POLICY "auth upload complaint media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ANY (ARRAY['complaint-images'::text, 'complaint-files'::text])
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 7. SECURITY DEFINER function lockdown.
-- Trigger + internal helpers: revoke EXECUTE from anon/authenticated/public.
-- Keep has_role and is_brand_member callable — RLS policies reference them.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_brand_complaints(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_brand_rating(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_comment_votes(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_brand_rating_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_comment_vote_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_complaint_brand_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_complaint_first_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_complaint_history_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_complaint_rating_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_escalation_to_modq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_report_to_modq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_verif_to_modq() FROM PUBLIC, anon, authenticated;
