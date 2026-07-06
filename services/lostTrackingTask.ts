import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'

export const LOST_TRACKING_TASK = 'LOQIT_LOST_TRACKING_TASK'

/**
 * Background Task Definition
 * This runs even when the app is in the background or killed.
 * It is triggered by the OS when location updates are available.
 */
if (!TaskManager.isTaskDefined(LOST_TRACKING_TASK)) {
  TaskManager.defineTask(LOST_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
      console.error(`[LOST-TRACKING] Task Error: ${error.message}`)
      return
    }

    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] }
      const location = locations[0]

      if (location) {
        console.log('[LOST-TRACKING] New background location received:', location.coords)

        try {
          // Get the device ID we are tracking from storage or use a session-based approach
          // Since this task is registered per-device via options, we can't easily pass it here directly
          // We'll fetch devices with status 'lost' for this user
          const { data: session } = await supabase.auth.getSession()
          if (!session?.session?.user?.id) return

          const userId = session.session.user.id

          // Find lost devices for this user
          const { data: lostDevices } = await db
            .from('devices')
            .select('id')
            .eq('owner_id', userId)
            .eq('status', 'lost')

          if (!lostDevices || lostDevices.length === 0) {
            // No lost devices, maybe stop the task?
            console.log('[LOST-TRACKING] No lost devices found, stopping task...')
            try {
              await Location.stopLocationUpdatesAsync(LOST_TRACKING_TASK)
            } catch (stopErr) {
              console.log('[LOST-TRACKING] Stop call ignored (task likely not running):', (stopErr as Error).message)
            }
            return
          }

          // Report location for all lost devices
          for (const device of lostDevices) {
            // 1. Update device last seen
            await db
              .from('devices')
              .update({
                last_seen_lat: location.coords.latitude,
                last_seen_lng: location.coords.longitude,
                last_seen_at: new Date().toISOString(),
              })
              .eq('id', device.id)

            // 2. Add to beacon logs for the live tracker view
            await db.from('beacon_logs').insert({
              device_id: device.id,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy_meters: location.coords.accuracy,
              reported_at: new Date().toISOString(),
            })
          }

          console.log(`[LOST-TRACKING] Successfully updated ${lostDevices.length} device(s)`)
        } catch (err) {
          console.error('[LOST-TRACKING] Supabase update failed:', err)
        }
      }
    }
  })
}

/**
 * Starts background location tracking for lost devices.
 * Uses high accuracy and attempts to update every 5 minutes (where possible).
 */
export async function startLostTracking() {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
  if (fgStatus !== 'granted') {
    console.warn('[LOST-TRACKING] Foreground location permission denied')
    return false
  }

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
  if (bgStatus !== 'granted') {
    console.warn('[LOST-TRACKING] Background location permission denied')
    return false
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOST_TRACKING_TASK)
  if (isRegistered) {
    console.log('[LOST-TRACKING] Task already registered, skipping...')
    return true
  }

  try {
    await Location.startLocationUpdatesAsync(LOST_TRACKING_TASK, {
      accuracy: Location.Accuracy.Balanced,
      // For Android: update roughly every 5 minutes
      timeInterval: 300000, 
      // For iOS/Android: update every 50 meters to save battery, 
      // but we want "every 5 mins" even if stationary if possible.
      // However, mobile OSs are restrictive.
      distanceInterval: 10, 
      // iOS specific:
      deferredUpdatesInterval: 300000,
      deferredUpdatesDistance: 50,
      foregroundService: {
        notificationTitle: 'LOQIT Active Tracking',
        notificationBody: 'Your lost device is being tracked in the background.',
        notificationColor: '#3D8EFF',
      },
    })
    console.log('[LOST-TRACKING] Background tracking started ✓')
    return true
  } catch (err) {
    console.error('[LOST-TRACKING] Failed to start task:', err)
    return false
  }
}

/**
 * Stops background location tracking.
 */
export async function stopLostTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOST_TRACKING_TASK)
  if (isRegistered) {
    try {
      await Location.stopLocationUpdatesAsync(LOST_TRACKING_TASK)
      console.log('[LOST-TRACKING] Background tracking stopped ✓')
    } catch (err) {
      console.log('[LOST-TRACKING] Task already stopped or not active:', (err as Error).message)
    }
  }
}
