import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import * as Cellular from 'expo-cellular'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Accelerometer } from 'expo-sensors'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'

export const PROTECTION_TASK = 'LOQIT_PROTECTION_TASK'
const SAVED_SIM_CARRIER_KEY = 'loqit_saved_sim_carrier'
const MY_ACTIVE_DEVICE_ID_KEY = 'loqit_my_active_device_id'
const LAST_ACCEL_KEY = 'loqit_last_accel'

// Threshold for "unusual" movement in g-force delta
const MOTION_THRESHOLD = 2.0

async function getLocation() {
  const perm = await Location.getBackgroundPermissionsAsync()
  if (perm.status !== 'granted') return null
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch {
    return null
  }
}

async function logTamperEvent(
  deviceId: string,
  ownerId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  location: { lat: number; lng: number } | null
) {
  await db.from('anti_theft_events').insert({
    device_id: deviceId,
    owner_id: ownerId,
    event_type: eventType,
    event_data: eventData,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    triggered_at: new Date().toISOString(),
  })
}

async function sendOwnerAlert(ownerId: string, deviceId: string, title: string, body: string) {
  await db.from('notifications').insert({
    user_id: ownerId,
    title,
    body,
    type: 'alert',
    reference_id: deviceId,
  })
}

if (!TaskManager.isTaskDefined(PROTECTION_TASK)) {
  TaskManager.defineTask(PROTECTION_TASK, async () => {
    console.log('[LOQIT-PROTECTION] Background tamper check started')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) return BackgroundFetch.BackgroundFetchResult.NoData

      const userId = sessionData.session.user.id
      const activeDeviceId = await AsyncStorage.getItem(MY_ACTIVE_DEVICE_ID_KEY)
      if (!activeDeviceId) return BackgroundFetch.BackgroundFetchResult.NoData

      // Load protection settings from DB
      const { data: protectionSettings } = await db
        .from('protection_settings')
        .select('*')
        .eq('device_id', activeDeviceId)
        .maybeSingle()

      if (!protectionSettings?.is_enabled) {
        return BackgroundFetch.BackgroundFetchResult.NoData
      }

      const gpsLocation = await getLocation()

      // ── Feature 1: SIM Change Detection ─────────────────
      if (protectionSettings.sim_watch) {
        const currentCarrier = await Cellular.getCarrierNameAsync()
        const savedCarrier = await AsyncStorage.getItem(SAVED_SIM_CARRIER_KEY)

        if (savedCarrier && currentCarrier && savedCarrier !== currentCarrier) {
          console.warn(`[LOQIT-PROTECTION] SIM Change: ${savedCarrier} → ${currentCarrier}`)

          await db.from('devices').update({ status: 'lost' }).eq('id', activeDeviceId)

          await logTamperEvent(activeDeviceId, userId, 'sim_change', {
            previous_carrier: savedCarrier,
            current_carrier: currentCarrier,
          }, gpsLocation)

          await sendOwnerAlert(userId, activeDeviceId, '⚠️ SIM Card Swapped',
            `Unauthorized SIM (${currentCarrier}) detected. Device auto-marked as Lost.`)

          // Update baseline
          await AsyncStorage.setItem(SAVED_SIM_CARRIER_KEY, currentCarrier)
        }
      }

      // ── Feature 2: Motion / Acceleration Anomaly ─────────
      if (protectionSettings.motion_watch) {
        try {
          const currentReading = await new Promise<{ x: number; y: number; z: number }>((resolve) => {
            const sub = Accelerometer.addListener((data) => {
              sub.remove()
              resolve(data)
            })
            Accelerometer.setUpdateInterval(500)
            // Timeout fallback
            setTimeout(() => resolve({ x: 0, y: 0, z: 9.8 }), 2000)
          })

          const lastRaw = await AsyncStorage.getItem(LAST_ACCEL_KEY)
          if (lastRaw) {
            const last = JSON.parse(lastRaw)
            const delta = Math.sqrt(
              Math.pow(currentReading.x - last.x, 2) +
              Math.pow(currentReading.y - last.y, 2) +
              Math.pow(currentReading.z - last.z, 2)
            )
            if (delta > MOTION_THRESHOLD) {
              console.warn(`[LOQIT-PROTECTION] Motion anomaly: Δ${delta.toFixed(2)}g`)

              await logTamperEvent(activeDeviceId, userId, 'motion_alert', {
                delta_g: parseFloat(delta.toFixed(3)),
                current: currentReading,
                previous: last,
              }, gpsLocation)

              await sendOwnerAlert(userId, activeDeviceId, '📳 Unusual Motion Detected',
                `Your device experienced sudden unusual movement (${delta.toFixed(1)}g delta). Check if it's safe.`)
            }
          }

          await AsyncStorage.setItem(LAST_ACCEL_KEY, JSON.stringify(currentReading))
        } catch (accelErr) {
          console.log('[LOQIT-PROTECTION] Accelerometer unavailable:', accelErr)
        }
      }

      // ── Feature 3: GPS Heartbeat ──────────────────────────
      if (gpsLocation) {
        // Update device record
        await db.from('devices').update({
          last_seen_at: new Date().toISOString(),
          last_seen_lat: gpsLocation.lat,
          last_seen_lng: gpsLocation.lng,
        }).eq('id', activeDeviceId)

        // NEW: Record to history log so owner can see the trail on the map
        await db.from('beacon_logs').insert({
          device_id: activeDeviceId,
          latitude: gpsLocation.lat,
          longitude: gpsLocation.lng,
          accuracy_meters: 10.0, // GPS accuracy estimate
          reported_at: new Date().toISOString()
        })

        console.log('[LOQIT-PROTECTION] GPS Heartbeat & Log recorded ✓')
      }

      // ── Feature 4: Remote Sync for Lost Status ─────────────
      // Check if server says we are lost, ensuring sync even if app was killed
      const { data: serverDevice } = await db
        .from('devices')
        .select('status, ble_device_uuid')
        .eq('id', activeDeviceId)
        .maybeSingle()

      if (serverDevice?.status === 'lost' || serverDevice?.status === 'stolen') {
        const { bleService } = require('./ble.service')
        const currentlyBroadcasting = await bleService.isBroadcastingMode()
        if (!currentlyBroadcasting && serverDevice.ble_device_uuid) {
          console.log('[LOQIT-PROTECTION] Background check: Device is LOST! Starting beacon...')
          await bleService.startBroadcasting(serverDevice.ble_device_uuid)
        }
      } else if (serverDevice?.status && serverDevice.status !== 'lost' && serverDevice.status !== 'stolen') {
        const { bleService } = require('./ble.service')
        const currentlyBroadcasting = await bleService.isBroadcastingMode()
        if (currentlyBroadcasting) {
          console.log('[LOQIT-PROTECTION] Background check: Device recovered. Stopping beacon...')
          await bleService.stopBroadcasting()
        }
      }

      return BackgroundFetch.BackgroundFetchResult.NewData
    } catch (err) {
      console.error('[LOQIT-PROTECTION] Error:', err)
      return BackgroundFetch.BackgroundFetchResult.Failed
    }
  })
}

export async function enableProtectionTask(deviceId: string) {
  await AsyncStorage.setItem(MY_ACTIVE_DEVICE_ID_KEY, deviceId)

  // Save baseline SIM carrier
  const carrier = await Cellular.getCarrierNameAsync()
  if (carrier) await AsyncStorage.setItem(SAVED_SIM_CARRIER_KEY, carrier)

  // Save baseline accelerometer
  try {
    const sample = await new Promise<{ x: number; y: number; z: number }>((resolve) => {
      const sub = Accelerometer.addListener((data) => { sub.remove(); resolve(data) })
      Accelerometer.setUpdateInterval(200)
      setTimeout(() => resolve({ x: 0, y: 0, z: 9.8 }), 1500)
    })
    await AsyncStorage.setItem(LAST_ACCEL_KEY, JSON.stringify(sample))
  } catch { /* sensor unavailable */ }

  const registered = await TaskManager.getRegisteredTasksAsync()
  const exists = registered.some((t) => t.taskName === PROTECTION_TASK)

  if (!exists) {
    await BackgroundFetch.registerTaskAsync(PROTECTION_TASK, {
      minimumInterval: 15 * 60, // 15-minute heartbeat
      stopOnTerminate: false,
      startOnBoot: true,
    })
    console.log('[LOQIT-PROTECTION] Active Tracker registered ✓')
  }
}

export async function disableProtectionTask() {
  const registered = await TaskManager.getRegisteredTasksAsync()
  const exists = registered.some((t) => t.taskName === PROTECTION_TASK)
  if (exists) {
    await BackgroundFetch.unregisterTaskAsync(PROTECTION_TASK)
    console.log('[LOQIT-PROTECTION] Task unregistered ✓')
  }
}
