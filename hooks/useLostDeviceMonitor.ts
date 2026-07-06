import { useCallback, useEffect, useState } from 'react'
import { NativeModules, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { bleService } from '../services/ble.service'
import { enableBackgroundBleScanTask } from '../services/backgroundBleTask'
import { enableProtectionTask } from '../services/protectionTask'
import { startLostTracking, stopLostTracking } from '../services/lostTrackingTask'
import { hasPasskeySet } from '../components/loqit/LostDeviceLock'

export type LostDeviceMonitor = {
  lockScreenActive: boolean
  lockDeviceId: string | null
  lockMessage: string | undefined
  dismissLock: () => void
  /** Re-run the BLE/beacon bootstrap (e.g. after the handset is paired). */
  rebootstrap: () => void
}

/**
 * Owns all "this physical device" monitoring that used to live inside AuthGate:
 *   - BLE bootstrap + always-on foreground scan
 *   - lost-beacon broadcasting + hardware lockdown
 *   - 2-minute GPS heartbeat
 *   - realtime device-status subscription (lost / remote-lock)
 *   - the lost-device lock screen state
 *
 * Extracting it keeps AuthGate focused on auth + routing. Behaviour is unchanged.
 */
export function useLostDeviceMonitor(session: Session | null): LostDeviceMonitor {
  const [lockScreenActive, setLockScreenActive] = useState(false)
  const [lockDeviceId, setLockDeviceId] = useState<string | null>(null)
  const [lockMessage, setLockMessage] = useState<string | undefined>()

  const bootstrapBleBackground = useCallback(async () => {
    try {
      if (!session) return

      await bleService.requestScanPermissions()
      const myActiveDeviceId = await AsyncStorage.getItem('loqit_my_active_device_id')

      let isActuallyLost = false
      let activeBleUuid = null

      if (myActiveDeviceId) {
        const { data: dev } = await db
          .from('devices')
          .select('status, ble_device_uuid, make, model, remote_lock_requested')
          .eq('id', myActiveDeviceId)
          .maybeSingle()

        if (dev?.status === 'lost' || dev?.status === 'stolen') {
          isActuallyLost = true
          activeBleUuid = dev.ble_device_uuid
        }

        // Show lock screen if device is lost OR if a remote lock was sent from dashboard
        const shouldLock = (dev?.status === 'lost' || dev?.status === 'stolen' || dev?.remote_lock_requested === true)
        if (shouldLock) {
          const pkSet = await hasPasskeySet(myActiveDeviceId)
          if (pkSet) {
            const { data: ps } = await db
              .from('protection_settings')
              .select('lock_message')
              .eq('device_id', myActiveDeviceId)
              .maybeSingle()
            setLockMessage(ps?.lock_message || undefined)
            setLockDeviceId(myActiveDeviceId)
            setLockScreenActive(true)
          }
        }
      }

      const locallyBroadcasting = await bleService.isBroadcastingMode()

      if (isActuallyLost && activeBleUuid) {
        console.log('[LOQIT] Boot: Device is LOST on server. Starting beacon...');
        try {
          await bleService.startBroadcasting(activeBleUuid)
          console.log('[LOQIT] Boot: Beacon started successfully.')
        } catch (broadcastErr) {
          console.warn('[LOQIT] Boot: Beacon failed (non-fatal):', broadcastErr)
        }

        // Safety: Start lockdown service after a short delay on boot
        if (Platform.OS === 'android') {
          setTimeout(() => {
            console.log('[LOQIT] Triggering hardware lockdown service...');
            const LOQITSecurity = NativeModules.LOQITSecurity;
            if (LOQITSecurity && typeof LOQITSecurity.startLockdownService === 'function') {
              LOQITSecurity.startLockdownService().catch((e: any) => console.log('Lockdown start error:', e));
            } else {
              console.log('[LOQIT] LOQITSecurity.startLockdownService not available.');
            }
          }, 2000);
        }
      } else if (locallyBroadcasting) {
        await bleService.restoreBroadcastingFromStorage().catch(() => {})
      }

      // ALWAYS enable background scanning — even if broadcasting
      await enableBackgroundBleScanTask()

      // Run the background heartbeat and tamper detection
      if (myActiveDeviceId) {
        await enableProtectionTask(myActiveDeviceId)
      }

      // Start lost tracking if any devices are lost
      const { data: lostDevices } = await db
        .from('devices')
        .select('id')
        .eq('owner_id', session.user.id)
        .eq('status', 'lost')

      if (lostDevices && lostDevices.length > 0) {
        await startLostTracking()
      }

      // ALWAYS start foreground scanning - every LOQIT user is a scout
      // Even lost devices scan so two lost devices can find each other
      console.log('[LOQIT] Starting always-on foreground BLE scan...');
      const startAutoScan = () => {
        bleService.scanForLOQITDevices((beaconId, rssi) => {
          console.log(`[LOQIT-AUTO] Detected: ${beaconId} RSSI: ${rssi} dBm`);
        }).catch(err => console.warn('[LOQIT-AUTO] Scan cycle error (will retry):', err));
      };
      startAutoScan();
      // Restart scan every 30s to keep it alive (Android kills idle scans)
      if ((globalThis as any).__loqitScanInterval) {
        clearInterval((globalThis as any).__loqitScanInterval);
      }
      const scanInterval = setInterval(startAutoScan, 30000);
      (globalThis as any).__loqitScanInterval = scanInterval;
    } catch (error) {
      console.error('[LOQIT] BLE bootstrap failed (non-fatal):', error)
    }
  }, [session])

  useEffect(() => {
    if (!session) return

    void bootstrapBleBackground()

    // Feature: 2-Minute Location Heartbeat
    let locationInterval: ReturnType<typeof setInterval> | null = null;
    const runLocationPing = async () => {
      try {
        const myId = await AsyncStorage.getItem('loqit_my_active_device_id');
        if (!myId) return;

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (pos) {
          await db.from('devices').update({
            last_seen_at: new Date().toISOString(),
            last_seen_lat: pos.coords.latitude,
            last_seen_lng: pos.coords.longitude,
          }).eq('id', myId);
          console.log('[LOQIT-HEARTBEAT] 💓 2-minute GPS location reported.');
        }
      } catch (e) {
        console.log('[LOQIT-HEARTBEAT] Location ping failed:', e);
      }
    };

    // Trigger immediately and then every 2 minutes
    runLocationPing();
    locationInterval = setInterval(runLocationPing, 120000);

    // Robust listener for 'THIS' physical device status (triggers immediate location report)
    AsyncStorage.getItem('loqit_my_active_device_id').then(async myId => {
      if (myId) {
        const { data: dev } = await db.from('devices').select('ble_device_uuid').eq('id', myId).maybeSingle()
        if (dev?.ble_device_uuid) {
          void bleService.startSelfStatusListener(myId, dev.ble_device_uuid);
        }
      }
    });

    // Listen for device status changes (starts/stops tracking, activates lock screen)
    const channel = db
      .channel('other-devices-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `owner_id=eq.${session.user.id}`,
        },
        async (payload) => {
          const newStatus = payload.new.status
          const oldStatus = payload.old.status
          const changedId = payload.new.id as string

          // Helper: activate lock screen for this device
          const activateLockScreen = async (deviceId: string) => {
            const pkSet = await hasPasskeySet(deviceId)
            if (pkSet) {
              const { data: ps } = await db
                .from('protection_settings')
                .select('lock_message')
                .eq('device_id', deviceId)
                .maybeSingle()
              setLockMessage(ps?.lock_message || undefined)
              setLockDeviceId(deviceId)
              setLockScreenActive(true)
            }
          }

          if (newStatus === 'lost' && oldStatus !== 'lost') {
            void startLostTracking()
            // If this is OUR physical device, show the lock screen
            const myId = await AsyncStorage.getItem('loqit_my_active_device_id')
            if (myId === changedId) await activateLockScreen(myId)
          } else if (payload.new.remote_lock_requested === true && !payload.old.remote_lock_requested) {
            // Remote lock command received from the web dashboard
            const myId = await AsyncStorage.getItem('loqit_my_active_device_id')
            if (myId === changedId) await activateLockScreen(myId)
          } else if (oldStatus === 'lost' && newStatus !== 'lost') {
            setLockScreenActive(false)
            void db
              .from('devices')
              .select('id')
              .eq('owner_id', session.user.id)
              .eq('status', 'lost')
              .then(({ data }) => {
                if (!data || data.length === 0) void stopLostTracking()
              })
          }
        }
      )
      .subscribe()

    return () => {
      if (locationInterval) clearInterval(locationInterval);
      void db.removeChannel(channel)
      void bleService.stopSelfStatusListener()
    }
    // Key on the user id (not the whole session object) so this heavy setup —
    // BLE bootstrap, location heartbeat, realtime subscription — does NOT tear
    // down and re-run on every routine token refresh / app resume.
  }, [session?.user?.id, bootstrapBleBackground])

  const dismissLock = useCallback(() => setLockScreenActive(false), [])

  return {
    lockScreenActive,
    lockDeviceId,
    lockMessage,
    dismissLock,
    rebootstrap: () => { void bootstrapBleBackground() },
  }
}
