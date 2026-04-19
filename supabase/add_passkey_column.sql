-- Add LOQIT passkey columns to protection_settings
-- Run this in your Supabase SQL editor

ALTER TABLE protection_settings
  ADD COLUMN IF NOT EXISTS loqit_passkey_hash TEXT,
  ADD COLUMN IF NOT EXISTS passkey_hint TEXT;

-- Optional: index for fast lookup by device_id (already likely exists, but ensures it)
CREATE INDEX IF NOT EXISTS idx_protection_settings_device_id ON protection_settings(device_id);
