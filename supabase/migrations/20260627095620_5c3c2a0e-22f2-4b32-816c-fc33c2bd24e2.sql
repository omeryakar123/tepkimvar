
-- 1. BRANDS extra fields
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS license_no text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_video text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS complaints_resolved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaints_pending integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

-- 2. COMPLAINTS rating
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS rating smallint;
ALTER TABLE public.complaints
  DROP CONSTRAINT IF EXISTS complaints_rating_check;
ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_rating_check CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5));

-- 3. BRAND_RATINGS
CREATE TABLE IF NOT EXISTS public.brand_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_ratings TO authenticated;
GRANT SELECT ON public.brand_ratings TO anon;
GRANT ALL ON public.brand_ratings TO service_role;
ALTER TABLE public.brand_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings public read" ON public.brand_ratings FOR SELECT USING (true);
CREATE POLICY "user upsert own rating" ON public.brand_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user update own rating" ON public.brand_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user delete own rating" ON public.brand_ratings FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER brand_ratings_updated_at BEFORE UPDATE ON public.brand_ratings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. COMMENTS (on complaints)
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments public read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "auth post comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "edit own comment" ON public.comments FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = comments.complaint_id AND c.user_id = auth.uid()));
CREATE POLICY "delete own comment" ON public.comments FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS comments_complaint_idx ON public.comments(complaint_id, created_at);

-- 5. COMMENT_VOTES
CREATE TABLE IF NOT EXISTS public.comment_votes (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_votes TO authenticated;
GRANT SELECT ON public.comment_votes TO anon;
GRANT ALL ON public.comment_votes TO service_role;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes public read" ON public.comment_votes FOR SELECT USING (true);
CREATE POLICY "auth vote" ON public.comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth change vote" ON public.comment_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "auth remove vote" ON public.comment_votes FOR DELETE USING (auth.uid() = user_id);

-- 6. VIDEOS
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  cover_url text,
  video_url text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos public read" ON public.videos FOR SELECT USING (status = 'published' OR auth.uid() = author_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "auth upload video" ON public.videos FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "edit own video" ON public.videos FOR UPDATE USING (auth.uid() = author_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "delete own video" ON public.videos FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 7. VIDEO_LIKES
CREATE TABLE IF NOT EXISTS public.video_likes (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_likes TO authenticated;
GRANT SELECT ON public.video_likes TO anon;
GRANT ALL ON public.video_likes TO service_role;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video likes public" ON public.video_likes FOR SELECT USING (true);
CREATE POLICY "auth like" ON public.video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth unlike" ON public.video_likes FOR DELETE USING (auth.uid() = user_id);

-- 8. AUTO TRIGGERS

-- Brand rating recompute
CREATE OR REPLACE FUNCTION public.recompute_brand_rating(_brand uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.brands b
  SET rating = COALESCE((SELECT round(avg(rating)::numeric, 2) FROM public.brand_ratings WHERE brand_id = _brand), 0),
      rating_count = (SELECT count(*) FROM public.brand_ratings WHERE brand_id = _brand)
  WHERE b.id = _brand;
END $$;

CREATE OR REPLACE FUNCTION public.tg_brand_rating_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_brand_rating(OLD.brand_id); RETURN OLD;
  ELSE
    PERFORM public.recompute_brand_rating(NEW.brand_id); RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS brand_rating_change ON public.brand_ratings;
CREATE TRIGGER brand_rating_change AFTER INSERT OR UPDATE OR DELETE ON public.brand_ratings
FOR EACH ROW EXECUTE FUNCTION public.tg_brand_rating_change();

-- Brand complaint counters
CREATE OR REPLACE FUNCTION public.recompute_brand_complaints(_brand uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _total int; _resolved int; _pending int;
BEGIN
  SELECT count(*) FILTER (WHERE status NOT IN ('rejected','spam')),
         count(*) FILTER (WHERE status = 'resolved'),
         count(*) FILTER (WHERE status IN ('pending','in_review','answered'))
  INTO _total, _resolved, _pending FROM public.complaints WHERE brand_id = _brand;
  UPDATE public.brands SET
    total_complaints = COALESCE(_total,0),
    complaints_resolved = COALESCE(_resolved,0),
    complaints_pending = COALESCE(_pending,0),
    resolution_rate = CASE WHEN COALESCE(_total,0)>0 THEN ROUND((_resolved::numeric / _total::numeric) * 100)::int ELSE 0 END
  WHERE id = _brand;
END $$;

CREATE OR REPLACE FUNCTION public.tg_complaint_brand_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.recompute_brand_complaints(OLD.brand_id); RETURN OLD; END IF;
  PERFORM public.recompute_brand_complaints(NEW.brand_id);
  IF TG_OP = 'UPDATE' AND OLD.brand_id <> NEW.brand_id THEN
    PERFORM public.recompute_brand_complaints(OLD.brand_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complaint_brand_count ON public.complaints;
CREATE TRIGGER complaint_brand_count AFTER INSERT OR UPDATE OR DELETE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_brand_count();

-- Comment vote counters
CREATE OR REPLACE FUNCTION public.recompute_comment_votes(_cid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.comments SET
    upvotes = (SELECT count(*) FROM public.comment_votes WHERE comment_id=_cid AND vote=1),
    downvotes = (SELECT count(*) FROM public.comment_votes WHERE comment_id=_cid AND vote=-1)
  WHERE id = _cid;
END $$;

CREATE OR REPLACE FUNCTION public.tg_comment_vote_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.recompute_comment_votes(OLD.comment_id); RETURN OLD; END IF;
  PERFORM public.recompute_comment_votes(NEW.comment_id); RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS comment_vote_change ON public.comment_votes;
CREATE TRIGGER comment_vote_change AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
FOR EACH ROW EXECUTE FUNCTION public.tg_comment_vote_change();

-- Auto-create brand rating from complaint rating
CREATE OR REPLACE FUNCTION public.tg_complaint_rating_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.rating IS NOT NULL THEN
    INSERT INTO public.brand_ratings(brand_id, user_id, rating)
    VALUES (NEW.brand_id, NEW.user_id, NEW.rating)
    ON CONFLICT (brand_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, updated_at = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complaint_rating_sync ON public.complaints;
CREATE TRIGGER complaint_rating_sync AFTER INSERT OR UPDATE OF rating ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_rating_sync();
