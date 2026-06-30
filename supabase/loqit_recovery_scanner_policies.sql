-- LOQIT community recovery scanner policies.
-- Run this in Supabase SQL Editor so authenticated LOQIT phones can resolve
-- lost/stolen BLE beacons and report sightings without exposing normal devices.

DROP POLICY IF EXISTS "devices_recovery_scanner_read" ON public.devices;
CREATE POLICY "devices_recovery_scanner_read"
ON public.devices
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR status IN ('lost', 'stolen')
);

DROP POLICY IF EXISTS "devices_recovery_scanner_location_update" ON public.devices;
CREATE POLICY "devices_recovery_scanner_location_update"
ON public.devices
FOR UPDATE
TO authenticated
USING (status IN ('lost', 'stolen'))
WITH CHECK (status IN ('lost', 'stolen'));

DROP POLICY IF EXISTS "beacon_logs_recovery_insert" ON public.beacon_logs;
CREATE POLICY "beacon_logs_recovery_insert"
ON public.beacon_logs
FOR INSERT
TO authenticated
WITH CHECK (true);
