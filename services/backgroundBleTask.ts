import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'

import { bleService } from './ble.service'
import { supabase } from '../lib/supabase'

export const BLE_SCAN_TASK = 'LOQIT_BLE_SCAN_TASK'

if (!TaskManager.isTaskDefined(BLE_SCAN_TASK)) {
  TaskManager.defineTask(BLE_SCAN_TASK, async () => {
    console.log('[LOQIT-BG] Background scan task started')

    try {
      // Step 1: Restore Supabase auth session from AsyncStorage
      // In background, the session may not be auto-loaded
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        console.log('[LOQIT-BG] No auth session available, skipping scan')
        return BackgroundFetch.BackgroundFetchResult.NoData
      }
      console.log('[LOQIT-BG] Auth session restored:', sessionData.session.user.id)

      const isBroadcasting = await bleService.isBroadcastingMode()
      if (isBroadcasting) {
        console.log('[LOQIT-BG] Device is in broadcasting mode, skipping scan')
        return BackgroundFetch.BackgroundFetchResult.NoData
      }

      const fgPermission = await Location.getForegroundPermissionsAsync()
      const bgPermission = await Location.getBackgroundPermissionsAsync()
      if (fgPermission.status !== 'granted' || bgPermission.status !== 'granted') {
        console.log('[LOQIT-BG] Location permissions not granted, skipping scan')
        return BackgroundFetch.BackgroundFetchResult.NoData
      }

      let detectedAny = false

      // Step 2: Start BLE scan
      console.log('[LOQIT-BG] Starting BLE scan...')
      await bleService.scanForLOQITDevices((beaconId, rssi) => {
        detectedAny = true
        console.log(`[LOQIT-BG] ✅ Detected LOQIT device: ${beaconId} RSSI: ${rssi}`)
      })

      // Step 3: Wait for scan to run (15 seconds for background)
      await new Promise((resolve) => setTimeout(resolve, 15000))
      bleService.stopScan()
      console.log(`[LOQIT-BG] Scan complete. Detected: ${detectedAny}`)

      // Step 4: Give async Supabase operations time to complete
      if (detectedAny) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        console.log('[LOQIT-BG] Lost device detected and location reported to owner.')
      }

      return detectedAny
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData
    } catch (err) {
      console.log('[LOQIT-BG] Background scan error:', err)
      bleService.stopScan()
      return BackgroundFetch.BackgroundFetchResult.Failed
    }
  })
}

export async function enableBackgroundBleScanTask() {
  try {
    const status = await BackgroundFetch.getStatusAsync()
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log('[LOQIT-BG] Background fetch restricted or denied')
      return false
    }

    const registered = await TaskManager.getRegisteredTasksAsync()
    const exists = registered.some((task) => task.taskName === BLE_SCAN_TASK)

    if (!exists) {
      await BackgroundFetch.registerTaskAsync(BLE_SCAN_TASK, {
        minimumInterval: 5 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      })
      console.log('[LOQIT-BG] Background scan task registered')
    }

    return true
  } catch (err) {
    console.warn('[LOQIT-BG] Background fetch registration error (caught):', err)
    return false
  }
}

export async function disableBackgroundBleScanTask() {
  try {
    const registered = await TaskManager.getRegisteredTasksAsync()
    const exists = registered.some((task) => task.taskName === BLE_SCAN_TASK)

    if (exists) {
      await BackgroundFetch.unregisterTaskAsync(BLE_SCAN_TASK)
    }
  } catch (err) {
    console.warn('[LOQIT-BG] Background fetch unregister error:', err)
  }
}

