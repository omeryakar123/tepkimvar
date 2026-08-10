
-- =========================================================
-- FAZ 1: ENTERPRISE DATA MODEL & SECURITY FOUNDATION
-- =========================================================

-- 1) public_id (XX-YYYY, ambiguous chars removed)
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS public_id text UNIQUE;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS sentiment_score text;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS sentiment_confidence numeric;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_high_priority boolean NOT NULL DEFAULT false;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS first_response_at timestamptz;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS first_response_minutes integer;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS is_white_label boolean NOT NULL DEFAULT false;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS white_label_source text;

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS avg_first_response_minutes integer;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'standard';

CREATE OR REPLACE FUNCTION public.gen_complaint_public_id()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  exists_row boolean;
  i int := 0;
BEGIN
  LOOP
    candidate := substr(alphabet, 1+floor(random()*length(alphabet))::int, 1)
              || substr(alphabet, 1+floor(random()*length(alphabet))::int, 1)
              || '-'
              || substr(alphabet, 1+floor(random()*length(alphabet))::int, 1)
              || substr(alphabet, 1+floor(random()*length(alphabet))::int, 1)
              || substr(alphabet, 1+floor(random()*length(alphabet))::int, 1)
              || substr(alphabet, 1+floor(random()*length(alphabet))::int, 1);
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE public_id = candidate) INTO exists_row;
    EXIT WHEN NOT exists_row OR i > 20;
    i := i + 1;
  END LOOP;
  RETURN candidate;
END $$;

CREATE OR REPLACE FUNCTION public.tg_complaint_public_id()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.public_id IS NULL THEN NEW.public_id := public.gen_complaint_public_id(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_complaint_public_id ON public.complaints;
CREATE TRIGGER trg_complaint_public_id BEFORE INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_public_id();

-- Backfill
UPDATE public.complaints SET public_id = public.gen_complaint_public_id() WHERE public_id IS NULL;

-- 2) complaint_history (timeline)
CREATE TABLE IF NOT EXISTS public.complaint_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.complaint_history TO authenticated, anon;
GRANT ALL ON public.complaint_history TO service_role;
ALTER TABLE public.complaint_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_public_read" ON public.complaint_history FOR SELECT USING (true);
CREATE POLICY "history_admin_write" ON public.complaint_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_complaint_history_cid ON public.complaint_history(complaint_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_complaint_history_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_history(complaint_id, from_status, to_status, changed_by, actor_role, note)
    VALUES (NEW.id, NULL, NEW.status::text, NEW.user_id, 'user', 'Şikayet oluşturuldu');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT role::text INTO _actor_role FROM public.user_roles WHERE user_id = auth.uid()
      ORDER BY CASE role::text WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 WHEN 'brand' THEN 4 ELSE 5 END
      LIMIT 1;
    INSERT INTO public.complaint_history(complaint_id, from_status, to_status, changed_by, actor_role)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), COALESCE(_actor_role,'user'));
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_complaint_history_insert() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_complaint_history_ins ON public.complaints;
CREATE TRIGGER trg_complaint_history_ins AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_history_insert();
DROP TRIGGER IF EXISTS trg_complaint_history_upd ON public.complaints;
CREATE TRIGGER trg_complaint_history_upd AFTER UPDATE OF status ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_history_insert();

-- 3) complaint_resolutions (thank-you + rating)
CREATE TABLE IF NOT EXISTS public.complaint_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL UNIQUE REFERENCES public.complaints(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thanks_message text,
  resolution_rating int NOT NULL CHECK (resolution_rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.complaint_resolutions TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.complaint_resolutions TO authenticated;
GRANT ALL ON public.complaint_resolutions TO service_role;
ALTER TABLE public.complaint_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "res_public_read" ON public.complaint_resolutions FOR SELECT USING (true);
CREATE POLICY "res_owner_insert" ON public.complaint_resolutions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "res_owner_update" ON public.complaint_resolutions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_res_brand ON public.complaint_resolutions(brand_id, created_at DESC);

-- 4) First response timing trigger on complaint_replies
CREATE OR REPLACE FUNCTION public.tg_complaint_first_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _c record; _mins int;
BEGIN
  SELECT id, brand_id, created_at, first_response_at INTO _c FROM public.complaints WHERE id = NEW.complaint_id;
  IF _c.id IS NULL THEN RETURN NEW; END IF;
  IF _c.first_response_at IS NULL AND NEW.is_brand = true THEN
    _mins := GREATEST(0, EXTRACT(EPOCH FROM (NEW.created_at - _c.created_at))::int / 60);
    UPDATE public.complaints SET first_response_at = NEW.created_at, first_response_minutes = _mins WHERE id = NEW.complaint_id;
    UPDATE public.brands SET avg_first_response_minutes = COALESCE((
      SELECT round(avg(first_response_minutes))::int FROM public.complaints WHERE brand_id = _c.brand_id AND first_response_minutes IS NOT NULL
    ), _mins) WHERE id = _c.brand_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_complaint_first_response() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_complaint_first_response ON public.complaint_replies;
CREATE TRIGGER trg_complaint_first_response AFTER INSERT ON public.complaint_replies
  FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_first_response();

-- 5) audit_logs IP column (inet)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address inet;

-- 6) Trend views
CREATE OR REPLACE VIEW public.v_trending_brands_7d AS
SELECT b.id, b.slug, b.name, b.logo_url, b.rating, b.verified, b.premium,
  COUNT(c.id) FILTER (WHERE c.created_at > now() - interval '7 days') AS recent_complaints,
  COUNT(c.id) FILTER (WHERE c.created_at > now() - interval '7 days' AND c.status = 'resolved') AS recent_resolved,
  COALESCE(SUM(c.views) FILTER (WHERE c.created_at > now() - interval '7 days'), 0) AS recent_views
FROM public.brands b
LEFT JOIN public.complaints c ON c.brand_id = b.id
WHERE b.is_active = true
GROUP BY b.id
ORDER BY recent_views DESC, recent_complaints DESC;

CREATE OR REPLACE VIEW public.v_trending_complaints_7d AS
SELECT c.id, c.public_id, c.short_id, c.title, c.created_at, c.views,
       c.brand_id, b.name AS brand_name, b.slug AS brand_slug, b.logo_url,
       (SELECT count(*) FROM public.comments cm WHERE cm.complaint_id = c.id) AS comment_count
FROM public.complaints c
JOIN public.brands b ON b.id = c.brand_id
WHERE c.created_at > now() - interval '7 days' AND c.status NOT IN ('rejected','spam','archived')
ORDER BY (c.views + (SELECT count(*) FROM public.comments cm WHERE cm.complaint_id = c.id)*5) DESC
LIMIT 50;

GRANT SELECT ON public.v_trending_brands_7d TO anon, authenticated;
GRANT SELECT ON public.v_trending_complaints_7d TO anon, authenticated;
