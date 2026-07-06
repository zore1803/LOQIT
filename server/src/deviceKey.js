import { createHash } from 'node:crypto'

// Deterministic LOQIT key + BLE UUID generation. Must stay byte-identical to
// the old Supabase edge function (supabase/functions/generate-device-key) so
// existing printed/paired keys keep verifying: SHA-256(payload + APP_SECRET).
export function generateDeviceKey({ state, imei_primary, imei_secondary, serial_number }) {
  const appSecret = process.env.APP_SECRET
  if (!appSecret) throw new Error('APP_SECRET is not set')

  const normalizedState = String(state).trim().toUpperCase()
  const imeiPrimaryLast6 = String(imei_primary).slice(-6)
  const imeiSecondaryLast6 = String(imei_secondary ?? imei_primary).slice(-6)
  const serialLast4 = String(serial_number).slice(-4).toUpperCase()

  const payload = `${normalizedState}${imeiPrimaryLast6}${imeiSecondaryLast6}${serialLast4}`
  const hashHex = createHash('sha256').update(payload + appSecret).digest('hex')

  const checksum = hashHex.slice(0, 4).toUpperCase()
  const loqit_key = `${normalizedState}-${imeiPrimaryLast6}-${imeiSecondaryLast6}-${serialLast4}-${checksum}`
  const hex32 = hashHex.slice(0, 32)
  const ble_device_uuid = `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20, 32)}`

  return { loqit_key, ble_device_uuid }
}
