
-- ============ ENUM GENİŞLETMELERİ ============
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'user_replied';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'super_admin_review';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'escalated';
ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'archived';

DO $$ BEGIN
  CREATE TYPE public.attachment_visibility AS ENUM ('public','brand_only','super_admin_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.escalation_reason AS ENUM (
    'wrong_brand','duplicate','spam','insult','profanity','wrong_category',
    'legal','fake_document','fake_screenshot','adult','spam_ad','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.escalation_status AS ENUM ('open','approved','rejected','returned','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending','reviewing','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_target AS ENUM ('complaint','comment','attachment','video','user','brand');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM ('spam','insult','adult','misinformation','fraud','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_kind AS ENUM ('escalation','report','sensitive','verification','adult','duplicate','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_state AS ENUM ('open','reviewing','resolved','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sanction_type AS ENUM ('warning','ban_temp','ban_permanent','unban');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.premium_request_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ COMPLAINTS GENİŞLETME ============
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS short_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE INDEX IF NOT EXISTS idx_complaints_short_id ON public.complaints(short_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);

-- Short ID generator (6-digit, unique, collision-retry)
CREATE OR REPLACE FUNCTION public.gen_complaint_short_id()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  candidate text;
  exists_row boolean;
  i int := 0;
BEGIN
  LOOP
    candidate := lpad((100000 + floor(random()*900000))::int::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE short_id = candidate) INTO exists_row;
    EXIT WHEN NOT exists_row OR i > 20;
    i := i + 1;
  END LOOP;
  RETURN candidate;
END $$;

CREATE OR REPLACE FUNCTION public.tg_complaint_short_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := public.gen_complaint_short_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complaints_short_id ON public.complaints;
CREATE TRIGGER complaints_short_id BEFORE INSERT ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_short_id();

-- Backfill any existing rows without short_id
UPDATE public.complaints SET short_id = public.gen_complaint_short_id() WHERE short_id IS NULL;

-- Status history append trigger
CREATE OR REPLACE FUNCTION public.tg_complaint_status_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_history := jsonb_build_array(jsonb_build_object(
      'status', NEW.status::text, 'at', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'), 'by', NEW.user_id
    ));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history := COALESCE(OLD.status_history,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'status', NEW.status::text, 'at', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'), 'by', auth.uid()
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complaints_status_history ON public.complaints;
CREATE TRIGGER complaints_status_history BEFORE INSERT OR UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_status_history();

-- ============ COMPLAINT ATTACHMENTS GENİŞLETME ============
ALTER TABLE public.complaint_attachments
  ADD COLUMN IF NOT EXISTS visibility public.attachment_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Tighten attachment read policy with visibility
DROP POLICY IF EXISTS "attachments read" ON public.complaint_attachments;
CREATE POLICY "attachments visibility read" ON public.complaint_attachments
FOR SELECT USING (
  CASE visibility
    WHEN 'public' THEN true
    WHEN 'brand_only' THEN (
      EXISTS (SELECT 1 FROM public.complaints c
              WHERE c.id = complaint_attachments.complaint_id
                AND (auth.uid() = c.user_id OR public.is_brand_member(c.brand_id, auth.uid())))
      OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
    )
    WHEN 'super_admin_only' THEN (public.has_role(auth.uid(),'super_admin'))
  END
);

-- ============ ESCALATIONS ============
CREATE TABLE IF NOT EXISTS public.complaint_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.escalation_reason NOT NULL,
  note text,
  status public.escalation_status NOT NULL DEFAULT 'open',
  decision text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaint_escalations TO authenticated;
GRANT ALL ON public.complaint_escalations TO service_role;
ALTER TABLE public.complaint_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalations read" ON public.complaint_escalations FOR SELECT
USING (
  auth.uid() = raised_by
  OR public.is_brand_member(brand_id, auth.uid())
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
);
CREATE POLICY "escalations insert by brand" ON public.complaint_escalations FOR INSERT
WITH CHECK (
  auth.uid() = raised_by AND (
    public.is_brand_member(brand_id, auth.uid())
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
  )
);
CREATE POLICY "escalations update admin" ON public.complaint_escalations FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS escalations_updated_at ON public.complaint_escalations;
CREATE TRIGGER escalations_updated_at BEFORE UPDATE ON public.complaint_escalations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_escal_status ON public.complaint_escalations(status);
CREATE INDEX IF NOT EXISTS idx_escal_complaint ON public.complaint_escalations(complaint_id);

-- ============ BRAND VERIFICATION REQUESTS ============
CREATE TABLE IF NOT EXISTS public.brand_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  website text,
  message text,
  status public.verification_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.brand_verification_requests TO authenticated;
GRANT ALL ON public.brand_verification_requests TO service_role;
ALTER TABLE public.brand_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verif read" ON public.brand_verification_requests FOR SELECT
USING (
  auth.uid() = submitted_by
  OR public.is_brand_member(brand_id, auth.uid())
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
);
CREATE POLICY "verif insert" ON public.brand_verification_requests FOR INSERT
WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "verif update admin" ON public.brand_verification_requests FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS verif_updated_at ON public.brand_verification_requests;
CREATE TRIGGER verif_updated_at BEFORE UPDATE ON public.brand_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ BRAND DOCUMENTS (super_admin only viewing) ============
CREATE TABLE IF NOT EXISTS public.brand_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- imza_sirkusu | faaliyet | sirket_evraki | domain_ss | lisans | yetki | kimlik | diger
  storage_path text NOT NULL,
  file_type text,
  file_size integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.brand_documents TO authenticated;
GRANT ALL ON public.brand_documents TO service_role;
ALTER TABLE public.brand_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs super admin read" ON public.brand_documents FOR SELECT
USING (public.has_role(auth.uid(),'super_admin') OR auth.uid() = uploaded_by);
CREATE POLICY "docs uploader insert" ON public.brand_documents FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "docs super admin delete" ON public.brand_documents FOR DELETE
USING (public.has_role(auth.uid(),'super_admin') OR auth.uid() = uploaded_by);

CREATE INDEX IF NOT EXISTS idx_brand_docs_brand ON public.brand_documents(brand_id);

-- ============ CONTENT REPORTS ============
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id uuid NOT NULL,
  reason public.report_reason NOT NULL,
  note text,
  status public.moderation_state NOT NULL DEFAULT 'open',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports read" ON public.content_reports FOR SELECT
USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "reports insert" ON public.content_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports update mod" ON public.content_reports FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.content_reports(target_type, target_id);

-- ============ MODERATION QUEUE ============
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.moderation_kind NOT NULL,
  state public.moderation_state NOT NULL DEFAULT 'open',
  priority int NOT NULL DEFAULT 0,
  target_type text,
  target_id uuid,
  related_table text,
  related_id uuid,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.moderation_queue TO authenticated;
GRANT ALL ON public.moderation_queue TO service_role;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modq staff read" ON public.moderation_queue FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "modq staff insert" ON public.moderation_queue FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "modq staff update" ON public.moderation_queue FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

DROP TRIGGER IF EXISTS modq_updated_at ON public.moderation_queue;
CREATE TRIGGER modq_updated_at BEFORE UPDATE ON public.moderation_queue
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_modq_state ON public.moderation_queue(state, priority DESC);
CREATE INDEX IF NOT EXISTS idx_modq_kind ON public.moderation_queue(kind);

-- Auto-create moderation queue entries from escalations & verifications & reports
CREATE OR REPLACE FUNCTION public.tg_escalation_to_modq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.moderation_queue(kind, target_type, target_id, related_table, related_id, summary, payload)
    VALUES ('escalation','complaint', NEW.complaint_id, 'complaint_escalations', NEW.id,
            'Escalation: '||NEW.reason::text, jsonb_build_object('reason', NEW.reason, 'note', NEW.note));
    UPDATE public.complaints SET escalated = true, status = 'super_admin_review' WHERE id = NEW.complaint_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_escal_to_modq ON public.complaint_escalations;
CREATE TRIGGER tg_escal_to_modq AFTER INSERT ON public.complaint_escalations
FOR EACH ROW EXECUTE FUNCTION public.tg_escalation_to_modq();

CREATE OR REPLACE FUNCTION public.tg_verif_to_modq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.moderation_queue(kind, target_type, target_id, related_table, related_id, summary, payload)
    VALUES ('verification','brand', NEW.brand_id, 'brand_verification_requests', NEW.id,
            'Doğrulama başvurusu: '||NEW.company_name, jsonb_build_object('contact', NEW.contact_name, 'phone', NEW.phone));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_verif_to_modq ON public.brand_verification_requests;
CREATE TRIGGER tg_verif_to_modq AFTER INSERT ON public.brand_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_verif_to_modq();

CREATE OR REPLACE FUNCTION public.tg_report_to_modq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.moderation_queue(kind, target_type, target_id, related_table, related_id, summary, payload)
    VALUES ('report', NEW.target_type::text, NEW.target_id, 'content_reports', NEW.id,
            'Rapor: '||NEW.reason::text, jsonb_build_object('reason', NEW.reason, 'note', NEW.note));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_report_to_modq ON public.content_reports;
CREATE TRIGGER tg_report_to_modq AFTER INSERT ON public.content_reports
FOR EACH ROW EXECUTE FUNCTION public.tg_report_to_modq();

-- ============ USER SANCTIONS ============
CREATE TABLE IF NOT EXISTS public.user_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.sanction_type NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_sanctions TO authenticated;
GRANT ALL ON public.user_sanctions TO service_role;
ALTER TABLE public.user_sanctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sanctions read self/staff" ON public.user_sanctions FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "sanctions insert staff" ON public.user_sanctions FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "sanctions update staff" ON public.user_sanctions FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- ============ PREMIUM REQUESTS ============
CREATE TABLE IF NOT EXISTS public.premium_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'standard',
  amount numeric(10,2),
  currency text NOT NULL DEFAULT 'TRY',
  status public.premium_request_status NOT NULL DEFAULT 'pending',
  note text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.premium_requests TO authenticated;
GRANT ALL ON public.premium_requests TO service_role;
ALTER TABLE public.premium_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "premreq read" ON public.premium_requests FOR SELECT
USING (auth.uid() = requested_by OR public.is_brand_member(brand_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "premreq insert" ON public.premium_requests FOR INSERT
WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "premreq update admin" ON public.premium_requests FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP TRIGGER IF EXISTS premreq_updated_at ON public.premium_requests;
CREATE TRIGGER premreq_updated_at BEFORE UPDATE ON public.premium_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ AUDIT LOGS GENİŞLETME ============
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';

-- Public insert by any authenticated user (the action is "their own"); already exists.
-- Allow staff to also insert (for system-attributed events).
DROP POLICY IF EXISTS "audit staff insert" ON public.audit_logs;
CREATE POLICY "audit staff insert" ON public.audit_logs FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator') OR auth.uid() = user_id);
