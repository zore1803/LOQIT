-- Remote lock command column on devices table
-- Run this in your Supabase SQL editor

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS remote_lock_requested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS remote_lock_at TIMESTAMPTZ;

-- Make sure Supabase realtime is enabled for the devices table
-- (already enabled if you use it for status updates)
