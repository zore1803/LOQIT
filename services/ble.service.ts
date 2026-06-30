import { PermissionsAndroid, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import {
  setServices,
  startAdvertising,
  stopAdvertising,
} from 'munim-bluetooth-peripheral'

import { supabase } from '../lib/supabase'

export type LoqitDetectedDevice = {
  id: string
  owner_id: string
  ble_device_uuid: string | null
  ble_beacon_id?: string | null
  make: string | null
  model: string | null
  status: string
}

type FoundCallback = (
  beaconId: string,
  rssi: number,
  name?: string,
  matchedDevice?: LoqitDetectedDevice | null
) => void

export const APP_SERVICE_UUID = '0000FD69-0000-1000-8000-00805F9B34FB'
const BLE_DEVICE_UUID_STORAGE_KEY = 'loqit_ble_device_uuid'
const BLE_BROADCASTING_MODE_STORAGE_KEY = 'loqit_ble_broadcasting_mode'
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const VALID_SERVICE_UUID_RE = /^([0-9a-f]{4}|[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const LOST_DEVICE_STATUSES = ['lost', 'stolen']

// ─── UUID helpers ────────────────────────────────────────────────────────────

function toNativeBleServiceUuid(value: string) {
  try {
    const mapped = value.replace(/p/gi, 'a').replace(/r/gi, 'f').toLowerCase()
    if (!VALID_SERVICE_UUID_RE.test(mapped)) {
      console.warn('[BLE-CONFIG] Invalid UUID format detected during conversion.');
      return value.toLowerCase(); 
    }
    return mapped
  } catch {
    return value.toLowerCase();
  }
}

const APP_SERVICE_UUID_NATIVE = toNativeBleServiceUuid(APP_SERVICE_UUID)

// ─── Base64 helpers ──────────────────────────────────────────────────────────

function encodeBase64Ascii(value: string) {
  let output = ''
  for (let i = 0; i < value.length; i += 3) {
    const b1 = value.charCodeAt(i) & 0xff
    const b2 = i + 1 < value.length ? value.charCodeAt(i + 1) & 0xff : Number.NaN
    const b3 = i + 2 < value.length ? value.charCodeAt(i + 2) & 0xff : Number.NaN
    const chunk = (b1 << 16) | ((Number.isNaN(b2) ? 0 : b2) << 8) | (Number.isNaN(b3) ? 0 : b3)
    output += BASE64_CHARS[(chunk >> 18) & 63]
    output += BASE64_CHARS[(chunk >> 12) & 63]
    output += Number.isNaN(b2) ? '=' : BASE64_CHARS[(chunk >> 6) & 63]
    output += Number.isNaN(b3) ? '=' : BASE64_CHARS[chunk & 63]
  }
  return output
}

function decodeBase64Ascii(value: string) {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '')
  let output = ''
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i] ?? 'A')
    const c2 = BASE64_CHARS.indexOf(clean[i + 1] ?? 'A')
    const c3Raw = clean[i + 2] ?? '='
    const c4Raw = clean[i + 3] ?? '='
    if (c1 < 0 || c2 < 0) continue
    const c3 = c3Raw === '=' ? 0 : BASE64_CHARS.indexOf(c3Raw)
    const c4 = c4Raw === '=' ? 0 : BASE64_CHARS.indexOf(c4Raw)
    const chunk = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4
    output += String.fromCharCode((chunk >> 16) & 0xff)
    if (c3Raw !== '=') output += String.fromCharCode((chunk >> 8) & 0xff)
    if (c4Raw !== '=') output += String.fromCharCode(chunk & 0xff)
  }
  return output
}

function encodeBase64(value: string) {
  const maybeBtoa = (globalThis as any).btoa
  return typeof maybeBtoa === 'function' ? maybeBtoa(value) : encodeBase64Ascii(value)
}

function decodeBase64(value: string) {
  const maybeAtob = (globalThis as any).atob
  return typeof maybeAtob === 'function' ? maybeAtob(value) : decodeBase64Ascii(value)
}

function uuidToCompressBase64(uuid: string): string {
  const clean = uuid.replace(/-/g, '')
  let bytes = ''
  for (let i = 0; i < clean.length; i += 2) {
    bytes += String.fromCharCode(parseInt(clean.substring(i, i + 2), 16))
  }
  return encodeBase64(bytes)
}

function extractUuidFromCompressedBase64(b64: string): string | null {
  try {
    const bytes = decodeBase64(b64)
    if (bytes.length < 16) return null
    let hex = ''
    for (let i = 0; i < 16; i++) {
      hex += bytes.charCodeAt(i).toString(16).padStart(2, '0')
    }
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`
  } catch {
    return null
  }
}

function createRotatingLostToken(bleUuid: string, timeBucket: number) {
  const rotationSecret = `${bleUuid}-${timeBucket}`
  return rotationSecret
    .split('')
    .reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    .toString(16)
}

// ─── BLEService ──────────────────────────────────────────────────────────────

class BLEService {
  public isScanningActive: boolean = false
  private isScanStarting: boolean = false

  public bluetoothState: string = 'Unknown'
  private manager: any = null
  private recentlySeen = new Map<string, number>()
  private broadcastingMode: boolean | null = null
  private stateSubscription: any = null
  private selfStatusSubscription: any = null
  private scanHeartbeat: ReturnType<typeof setInterval> | null = null
  private rotationInterval: any = null
  private _isBroadcasting: boolean = false

  constructor() {
    // FIX CODE 600: NEVER instantiate BleManager in the constructor.
    // If RxBleClient is created BEFORE permissions are granted natively, it caches Location=False 
    // and permanently errors out with "Cannot start scanning operation" (Code 600) until a hard reboot.
    this.manager = null
  }

  // ─── Bluetooth Initialization / Fixes ────────────────────────────────────────

  async resetManager() {
    try {
      if (this.manager) this.manager.destroy()
      const bleModule = require('react-native-ble-plx')
      this.manager = new bleModule.BleManager()
      console.log('[BLE-INIT] ✅ Manager recreated successfully AFTER permissions were secured.')
      
      this.manager.onStateChange((state: string) => {
        console.log(`[BLE-INIT] Bluetooth state changed (post-reset): ${state}`)
        this.bluetoothState = state
        if (state === 'PoweredOn') void this.restoreBroadcastingFromStorage()
      }, true)

      // Let the native bridge stabilize across the event loop
      await new Promise(res => setTimeout(res, 1000))
    } catch (e) {
      console.error('[BLE-INIT] Failed to reset manager:', e)
    }
  }

  // ─── Permissions ────────────────────────────────────────────────────────────

  async requestScanPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        console.warn('[BLE-PERMS] ❌ Location permission denied.')
        return false
      }

      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          const res = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ])
          console.log('[BLE-PERMS] Results:', JSON.stringify(res))
          const scanGranted = res['android.permission.BLUETOOTH_SCAN'] === 'granted'
          const locGranted = res['android.permission.ACCESS_FINE_LOCATION'] === 'granted'
          if (!scanGranted) console.warn('[BLE-PERMS] ❌ BLUETOOTH_SCAN denied.')
          if (!locGranted) console.warn('[BLE-PERMS] ❌ ACCESS_FINE_LOCATION denied.')
          return scanGranted && locGranted
        }
        const fine = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        )
        console.log(`[BLE-PERMS] ACCESS_FINE_LOCATION: ${fine}`)
        return fine === 'granted'
      }
    } catch (e) {
      console.warn('[BLE-PERMS] Exception during permission request:', e)
      return false
    }
    return true
  }

  // ─── Bluetooth power check ───────────────────────────────────────────────────

  private async ensureBluetoothPoweredOn(): Promise<void> {
    // Lazy Initialization: Only build the manager once we actually need it, 
    // ensuring the user has already passed the permission check layer!
    if (!this.manager) await this.resetManager()
    
    return new Promise((resolve, reject) => {
      let enableRequested = false
      const subscription = this.manager.onStateChange((state: string) => {
        console.log(`[BLE] ensureBluetoothPoweredOn — current state: ${state}`)
        if (state === 'PoweredOn') {
          subscription.remove()
          resolve()
        } else if (state === 'PoweredOff') {
          if (Platform.OS === 'android' && !enableRequested && typeof this.manager.enable === 'function') {
            enableRequested = true
            console.log('[BLE] Bluetooth is off. Requesting Android Bluetooth enable...')
            this.manager.enable().catch((enableError: any) => {
              subscription.remove()
              reject(new Error(`[BLE] Bluetooth enable request failed: ${enableError?.message ?? enableError}`))
            })
            this.isScanningActive = false
            return
          }
          subscription.remove()
          reject(new Error('[BLE] Bluetooth is PoweredOff. Turn on Bluetooth and try again.'))
        } else if (
          state === 'Unauthorized' ||
          state === 'Unsupported'
        ) {
          subscription.remove()
          reject(new Error(`[BLE] Bluetooth is ${state}. Turn on Bluetooth and try again.`))
        }
      }, true) // emitCurrentValue: true resolves immediately if already PoweredOn

      // Fallback timeout — avoids hanging indefinitely on stuck states
      setTimeout(() => {
        subscription.remove()
        reject(new Error('[BLE] Timed out waiting for Bluetooth to power on.'))
      }, 5000)
    })
  }

  async scanForAllDevices(onDeviceFound: (device: any) => void): Promise<boolean> {
    try {
      const hasPerms = await this.requestScanPermissions()
      if (!hasPerms) {
        console.warn('[BLE-SCAN] ❌ Permissions denied. Aborting scan.')
        return false
      }

      await this.ensureBluetoothPoweredOn()
      
      // FIX Error 600: Always clear zombie scanners before starting a new one
      this.manager.stopDeviceScan()
      
      this.isScanningActive = true
      console.log('[BLE-SCAN] Starting scan for ALL devices...')

      this.manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error) {
            console.error(`[BLE-SCAN] ❌ Scan error — code: ${error.errorCode}, message: ${error.message}`)
            return
          }
          if (device) {
            onDeviceFound({
              id: device.id,
              name: device.localName || device.name || 'Unknown',
              rssi: device.rssi || -100,
            })
          }
        }
      )
      return true
    } catch (e) {
      console.warn('[BLE-SCAN] scanForAllDevices failed:', e)
      this.isScanningActive = false
      return false
    }
  }

  // ─── Scan for LOQIT devices ──────────────────────────────────────────────────

  async scanForLOQITDevices(onDeviceFound: FoundCallback): Promise<boolean> {

    // Hard lock — if a scan is already starting OR active, do nothing
    if (this.isScanStarting || this.isScanningActive) {
      console.warn('[BLE-SCAN] Scan already running — ignoring duplicate call.')
      return false
    }

    this.isScanStarting = true

    try {
      const hasPerms = await this.requestScanPermissions()
      if (!hasPerms) {
        console.warn('[BLE-SCAN] ❌ Permissions denied. Aborting scan.')
        this.isScanStarting = false
        return false
      }

      await this.ensureBluetoothPoweredOn()
      
      // Stop any lingering native scan just in case
      this.manager.stopDeviceScan()
      await new Promise(res => setTimeout(res, 500))

      this.isScanningActive = true
      this.isScanStarting = false
      console.log('[BLE-SCAN] ✅ Starting LOQIT device scan...')

      // Heartbeat — confirms scan loop is alive every 5s
      if (this.scanHeartbeat) clearInterval(this.scanHeartbeat)
      this.scanHeartbeat = setInterval(() => {
        if (!this.isScanningActive) {
          if (this.scanHeartbeat) clearInterval(this.scanHeartbeat)
          return
        }
        console.log('[BLE-SCAN] 💓 Scan heartbeat — still scanning, no LOQIT device found yet.')
      }, 5000)

      this.manager.startDeviceScan(
        null,
        { allowDuplicates: true },
        (err: any, dev: any) => {
          // FIX: log scan errors with error code instead of silently returning
          if (err) {
            console.error(`[BLE-SCAN] ❌ Scan error — code: ${err.errorCode}, message: ${err.message}`)
            this.isScanningActive = false
            return
          }
          if (!dev) return

          const deviceName = dev.localName || dev.name || 'Unknown'
          
          // DEBUG LOG: See every device seen by the scanner
          console.log(`[BLE-DEBUG] Discovered: "${deviceName}" | id: ${dev.id} | RSSI: ${dev.rssi}`);

          // Pure LocalName Compression extraction!
          let specificUuid = null
          if (deviceName.startsWith('LQT-')) {
            const b64 = deviceName.substring(4)
            specificUuid = extractUuidFromCompressedBase64(b64)
            console.log(`[BLE-DEBUG] 🎯 Found LQT prefix! Extracted UUID: ${specificUuid}`);
          }

          if (!specificUuid) {
            // Robust UUID Check: Look for the LOQIT Service UUID (FD69) in any format
            const targets = [APP_SERVICE_UUID.toLowerCase(), '0000fd69-0000-1000-8000-00805f9b34fb', 'fd69']
            
            const match = dev.serviceUUIDs?.find((u: string) => 
              targets.some(t => u.toLowerCase().includes(t))
            )

            if (match) {
              specificUuid = match
            } else if (dev.serviceData) {
              // Check keys in serviceData
              const hasData = Object.keys(dev.serviceData).some(k => 
                targets.some(t => k.toLowerCase().includes(t))
              )
              if (hasData) specificUuid = APP_SERVICE_UUID
            }
          }

          // STRICT FILTER: Stop any random smartwatch/TV from pretending to be LOQIT
          if (!specificUuid) return

          const id = dev.id || 'N/A'
          const rssi = dev.rssi || -100
          const now = Date.now()
          const dedupeKey = specificUuid || id

          // Deduplicate — ignore if seen within last 4.5 seconds
          if ((this.recentlySeen.get(dedupeKey) || 0) > now - 4500) return
          this.recentlySeen.set(dedupeKey, now)

          const beaconId = specificUuid || dedupeKey
          console.log(
            `[BLE-SCAN] LOQIT device found: "${deviceName}" | uuid=${beaconId} | id=${id} | rssi=${rssi}`
          )

          void this.reportDetectedLostDevice(beaconId, rssi, deviceName).then((matchedDevice) => {
            onDeviceFound(
              matchedDevice?.ble_device_uuid || matchedDevice?.ble_beacon_id || matchedDevice?.id || beaconId,
              rssi,
              deviceName,
              matchedDevice
            )
          })
        }
      )
      return true
    } catch (e) {
      console.warn('[BLE-SCAN] Scan start failed:', e)
      this.isScanStarting = false
      this.isScanningActive = false
      return false
    }
  }

  // ─── Broadcasting ────────────────────────────────────────────────────────────

  async startBroadcasting(bleUuid: string) {
    if (Platform.OS !== 'android') return
    const b64Uuid = uuidToCompressBase64(bleUuid)
    const localName = `LQT-${b64Uuid}`
    try {
      await startAdvertising({ serviceUUIDs: [APP_SERVICE_UUID_NATIVE], localName })
      await AsyncStorage.setItem(BLE_DEVICE_UUID_STORAGE_KEY, bleUuid)
      await this.setBroadcastingMode(true)
    } catch (e) {
      console.error('[BLE-BROADCAST] Start failed:', e)
    }
  }

  async advertiseAsLost(deviceId: string, bleUuid: string) {
    if (this._isBroadcasting) {
      console.log('[BLE-BROADCAST] Already advertising or rotation active.');
    }

    if (Platform.OS !== 'android') return

    const startBroadcastingWithCurrentToken = async () => {
      const timeBucket = Math.floor(Date.now() / 900000);
      const stealthToken = createRotatingLostToken(bleUuid, timeBucket);
      const localName = `LQT-${stealthToken}`;

      console.log(`[BLE-BROADCAST] 🕵️ Stealth Beacon: ${localName}`)
      try {
        await stopAdvertising();
        await startAdvertising({ serviceUUIDs: [APP_SERVICE_UUID_NATIVE], localName })
        this._isBroadcasting = true
        await AsyncStorage.setItem(BLE_DEVICE_UUID_STORAGE_KEY, bleUuid)
        await this.setBroadcastingMode(true)
      } catch (e: any) {
        console.error(`[BLE-BROADCAST] Toggle Failed: ${e?.message ?? e}`)
      }
    };

    await startBroadcastingWithCurrentToken();

    if (this.rotationInterval) clearInterval(this.rotationInterval);
    this.rotationInterval = setInterval(() => {
      startBroadcastingWithCurrentToken();
    }, 900000);
  }

  async stopBroadcasting() {
    console.log('[BLE-BROADCAST] Stopping all beacons...')
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
    await stopAdvertising()
    this._isBroadcasting = false
    await this.setBroadcastingMode(false)
  }

  // ─── Self status listener (Supabase realtime) ────────────────────────────────

  async startSelfStatusListener(deviceId: string, bleUuid: string) {
    if (this.selfStatusSubscription) this.selfStatusSubscription.unsubscribe()
    const chan = supabase.channel(`self-${deviceId}`)
    this.selfStatusSubscription = chan
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          table: 'devices',
          schema: 'public',
          filter: `id=eq.${deviceId}`,
        },
        async (payload: any) => {
          console.log(`[BLE-STATUS] Device ${deviceId} status changed to: ${payload.new.status}`)
          if (payload.new.status === 'lost' || payload.new.status === 'stolen') {
            void this.advertiseAsLost(deviceId, bleUuid)
          } else {
            void this.stopBroadcasting()
          }
        }
      )
      .subscribe()
  }

  stopSelfStatusListener() {
    this.selfStatusSubscription?.unsubscribe()
    this.selfStatusSubscription = null
  }

  // ─── Report detected lost device to Supabase ─────────────────────────────────

  async reportDetectedLostDevice(id: string, rssi: number, name?: string): Promise<LoqitDetectedDevice | null> {
    const key = `report-${id}`
    const now = Date.now()
    if ((this.recentlySeen.get(key) || 0) > now - 30000) return null
    this.recentlySeen.set(key, now)

    try {
      let data: LoqitDetectedDevice | null = null;

      // STEALTH MODE CHECK: If name starts with LQT-, it's a rotating token
      if (name && name.startsWith('LQT-')) {
        const token = name.replace('LQT-', '');
        const timeBucket = Math.floor(Date.now() / 900000);
        
        // Fetch ALL lost devices to find the match (approx 15-min window)
        const { data: lostDevices } = await supabase.from('devices')
            .select('id, owner_id, ble_device_uuid, ble_beacon_id, make, model, status')
            .in('status', LOST_DEVICE_STATUSES)
            .not('ble_device_uuid', 'is', null);
            
        if (lostDevices) {
            for (const dev of lostDevices as LoqitDetectedDevice[]) {
                if (!dev.ble_device_uuid) continue;
                const matchedBucket = [timeBucket - 1, timeBucket, timeBucket + 1].some(
                  (bucket) => createRotatingLostToken(dev.ble_device_uuid!, bucket) === token
                );
                if (matchedBucket) {
                    data = dev;
                    console.log(`[BLE-DECODE] 🔓 Stealth Identity Unmasked: ${dev.id}`);
                    break;
                }
            }
        }
      }

      // FALLBACK: Normal ID matching
      if (!data) {
        const { data: exactMatched } = await supabase
            .from('devices')
            .select('id, owner_id, ble_device_uuid, ble_beacon_id, make, model, status')
            .or(`ble_device_uuid.eq.${id},ble_beacon_id.eq.${id}`)
            .in('status', LOST_DEVICE_STATUSES)
            .maybeSingle()
        data = exactMatched;
      }

      if (!data && name && !name.startsWith('LQT-') && name.length > 3) {
        const { data: fuzzy } = await supabase
          .from('devices')
          .select('id, owner_id, ble_device_uuid, ble_beacon_id, make, model, status')
          .in('status', LOST_DEVICE_STATUSES)
          .or(`make.ilike.%${name}%,model.ilike.%${name}%`)
          .maybeSingle()
        data = fuzzy
      }

      if (data?.id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[BLE-LOG] ⚠️ No user logged in, skipping report.');
          return data;
        }
        const pos = await Location.getCurrentPositionAsync({}).catch(() => null)
        if (pos) {
          await supabase.from('beacon_logs').insert({
            device_id: data.id,
            reporter_id: user.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_meters: pos.coords.accuracy,
            rssi,
            reported_at: new Date().toISOString()
          })

          // 1. NOTIFY OWNER
          await supabase.from('notifications').insert({
            user_id: data.owner_id,
            title: '📡 Device Spotted!',
            body: `Your lost device has been detected by a nearby scout at a new location. Check the map!`,
            type: 'discovery_alert',
            reference_id: data.id
          });

          // 2. POLICE PORTAL UPDATE: Insert high-priority discovery event
          await supabase.from('anti_theft_events').insert({
            device_id: data.id,
            owner_id: data.owner_id,
            event_type: 'discovery_alert',
            event_data: { 
              rssi, 
              source: 'scout_verified_scan',
              scouter_id: user.id,
              accuracy: pos.coords.accuracy,
              message: `High-priority: Device spotted at location by community scout. Signal Strength: ${rssi}dBm.`
            },
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            triggered_at: new Date().toISOString()
          });

          await supabase
            .from('devices')
            .update({
              last_seen_at: new Date().toISOString(),
              last_seen_lat: pos.coords.latitude,
              last_seen_lng: pos.coords.longitude,
            })
            .eq('id', data.id)
          console.log(`[BLE-LOG] ✅ Reported lost device ${data.id} at (${pos.coords.latitude}, ${pos.coords.longitude})`)
        }
      }
      return data
    } catch (e) {
      console.warn('[BLE-LOG] Report failed:', e)
      return null
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  async stopScan() {
    this.isScanningActive = false
    this.isScanStarting = false
    if (this.scanHeartbeat) {
      clearInterval(this.scanHeartbeat)
      this.scanHeartbeat = null
    }
    this.manager?.stopDeviceScan()
    console.log('[BLE-SCAN] Scan stopped.')
  }

  async isBroadcastingMode() {
    return (await AsyncStorage.getItem(BLE_BROADCASTING_MODE_STORAGE_KEY)) === '1'
  }

  private async setBroadcastingMode(v: boolean) {
    await AsyncStorage.setItem(BLE_BROADCASTING_MODE_STORAGE_KEY, v ? '1' : '0')
  }

  async restoreBroadcastingFromStorage() {
    if (await this.isBroadcastingMode()) {
      const id = await AsyncStorage.getItem(BLE_DEVICE_UUID_STORAGE_KEY)
      if (id) {
        console.log('[BLE-BROADCAST] Restoring broadcast from storage...')
        await this.startBroadcasting(id)
      }
    }
  }

  normalizeBleUuid(v: any) {
    return v
  }

  readBleUuidFromBeaconName(v: any): string | null {
    if (!v || typeof v !== 'string') return null
    const matched = v.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
    )
    if (matched) return matched[0].toLowerCase()
    if (v.toUpperCase().startsWith('LOQIT-')) return v.trim().toLowerCase()
    return null
  }

  private readBleUuidFromManufacturerData(manufacturerData?: string | null): string | null {
    if (!manufacturerData) return null
    return extractUuidFromCompressedBase64(manufacturerData)
  }
}

export const bleService = new BLEService()
