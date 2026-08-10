
-- Fix search_path on new functions
ALTER FUNCTION public.gen_complaint_short_id() SET search_path = public;
ALTER FUNCTION public.tg_complaint_short_id() SET search_path = public;
ALTER FUNCTION public.tg_complaint_status_history() SET search_path = public;

-- Revoke EXECUTE from anon on SECURITY DEFINER trigger fns (they're trigger-only)
REVOKE EXECUTE ON FUNCTION public.tg_escalation_to_modq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_verif_to_modq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_report_to_modq() FROM PUBLIC, anon, authenticated;

-- email_otps: ensure RLS + lock down (service-role only via edge functions)
DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN NULL; END $$;
DROP POLICY IF EXISTS "otps no public" ON public.email_otps;
CREATE POLICY "otps no public" ON public.email_otps FOR SELECT USING (false);
