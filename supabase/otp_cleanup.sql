-- ============================================================
-- LOQIT: OTP Cleanup — Removes expired OTPs stored by n8n
-- Run once to set up; the function can be called manually
-- or scheduled via Supabase pg_cron (if enabled).
-- ============================================================

-- Create otp_store table if n8n is writing OTPs here
-- (Only creates if it does not already exist — safe to re-run)
CREATE TABLE IF NOT EXISTS public.otp_store (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  otp         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_otp_store_email ON public.otp_store(email);
CREATE INDEX IF NOT EXISTS idx_otp_store_expires ON public.otp_store(expires_at);

-- RLS: only service role (n8n webhook) can read/write OTPs
ALTER TABLE public.otp_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "otp_service_only" ON public.otp_store;
CREATE POLICY "otp_service_only" ON public.otp_store
  FOR ALL USING (false); -- blocked for all non-service-role callers

-- Function: delete OTPs older than 10 minutes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.otp_store
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'cleanup_expired_otps: removed % expired OTP(s)', deleted_count;
  RETURN deleted_count;
END;
$$;

-- Optional: schedule automatic cleanup every 5 minutes using pg_cron
-- Uncomment the lines below if pg_cron is enabled on your Supabase project
-- (Available on Pro plan and above under Database > Extensions)
--
-- SELECT cron.schedule(
--   'cleanup-expired-otps',
--   '*/5 * * * *',
--   $$ SELECT public.cleanup_expired_otps(); $$
-- );

-- To run manually at any time:
-- SELECT public.cleanup_expired_otps();
