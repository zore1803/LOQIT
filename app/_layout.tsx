import { ActivityIndicator, Platform, StyleSheet, View, Text, Pressable, NativeModules } from 'react-native'
import { useCallback, useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Colors } from '../constants/colors'
import { AuthProvider, useAuth } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { bleService } from '../services/ble.service'
import { disableBackgroundBleScanTask, enableBackgroundBleScanTask } from '../services/backgroundBleTask'
import { enableProtectionTask } from '../services/protectionTask'
import { startLostTracking, stopLostTracking } from '../services/lostTrackingTask'
import { LostDeviceLock, hasPasskeySet } from '../components/loqit/LostDeviceLock'

import { FontFamily } from '../constants/typography'
import * as Location from 'expo-location'
import * as Linking from 'expo-linking'
import * as Application from 'expo-application'
import * as Device from 'expo-device'
import { PairingGate } from '../components/loqit/PairingGate'

// Side-effect imports for task registration
import '../services/backgroundBleTask'
import '../services/protectionTask'
import '../services/lostTrackingTask'

async function getHandsetIdentifier() {
  let id = await AsyncStorage.getItem('loqit_handset_id')
  if (!id) {
    // Generate a unique ID if none exists. 
    // This is safer than relying on ever-changing OS IDs
    id = `hset-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`
    await AsyncStorage.setItem('loqit_handset_id', id)
  }
  return id
}

function AuthGate() {
  const { session, loading, profile, isLoggingIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  const [lockScreenActive, setLockScreenActive] = useState(false)
  const [lockDeviceId, setLockDeviceId] = useState<string | null>(null)
  const [lockMessage, setLockMessage] = useState<string | undefined>()

  // ... (bootstrapBleBackground logic remains the same)

  const bootstrapBleBackground = useCallback(async () => {
    try {
      if (!session) return

      await bleService.requestScanPermissions()
      const myActiveDeviceId = await AsyncStorage.getItem('loqit_my_active_device_id')
      
      let isActuallyLost = false
      let activeBleUuid = null

      if (myActiveDeviceId) {
         const { data: dev } = await supabase
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
             const { data: ps } = await supabase
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
      const { data: lostDevices } = await supabase
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
  }, [session, profile, isLoggingIn])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    void bootstrapBleBackground()
    
    // Feature: 2-Minute Location Heartbeat
    let locationInterval: NodeJS.Timeout | null = null;
    const runLocationPing = async () => {
      try {
        const myId = await AsyncStorage.getItem('loqit_my_active_device_id');
        if (!myId) return;

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (pos) {
          await supabase.from('devices').update({
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


    // NEW: Robust listener for 'THIS' physical device status (triggers immediate location report)
    AsyncStorage.getItem('loqit_my_active_device_id').then(async myId => {
      if (myId) {
        const { data: dev } = await supabase.from('devices').select('ble_device_uuid').eq('id', myId).maybeSingle()
        if (dev?.ble_device_uuid) {
          void bleService.startSelfStatusListener(myId, dev.ble_device_uuid);
        }
      }
    });

    // Listen for device status changes (starts/stops tracking, activates lock screen)
    const channel = supabase
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
              const { data: ps } = await supabase
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
            void supabase
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
      cancelled = true
      if (locationInterval) clearInterval(locationInterval);
      void supabase.removeChannel(channel)
      void bleService.stopSelfStatusListener()
    }
  }, [session])

  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false)

  // Extract tokens from a URL (checks both query params and hash fragment)
  const extractTokensFromUrl = (url: string) => {
    const parsed = Linking.parse(url)
    let accessToken = parsed.queryParams?.access_token as string
    let refreshToken = parsed.queryParams?.refresh_token as string

    if (!accessToken && url.includes('#')) {
      const fragment = url.split('#')[1]
      const params = new URLSearchParams(fragment)
      accessToken = params.get('access_token') || ''
      refreshToken = params.get('refresh_token') || ''
    }
    return { accessToken, refreshToken }
  }

  // Process a login deep link: extract tokens and set the Supabase session
  const handleLoginUrl = async (url: string) => {
    console.log('[AuthGate] Processing login URL directly...')
    setIsProcessingDeepLink(true)
    const { accessToken, refreshToken } = extractTokensFromUrl(url)
    if (accessToken) {
      console.log('[AuthGate] Tokens found! Setting session...')
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })
      if (error) {
        console.error('[AuthGate] setSession error:', error)
      } else {
        console.log('[AuthGate] Session set successfully! Navigating to tabs...')
        router.replace('/(tabs)')
      }
    } else {
      console.log('[AuthGate] No tokens found in URL.')
    }
    setIsProcessingDeepLink(false)
  }

  useEffect(() => {
    // 1. Check if we were opened by a login deep link (cold start)
    const checkInitialUrl = async () => {
      try {
        const url = await Linking.getInitialURL()
        if (url && url.includes('auth/callback')) {
          console.log('[AuthGate] Cold-start login link detected. Processing...')
          await handleLoginUrl(url)
        }
      } catch (err) {
        console.warn('[AuthGate] Initial URL check failed:', err)
      }
    }
    checkInitialUrl()

    // 2. Listen for links while the app is alive (warm start / background)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url && url.includes('auth/callback')) {
        console.log('[AuthGate] Background login link detected. Processing...')
        handleLoginUrl(url)
      }
    })

    return () => subscription.remove()
  }, [])

  useEffect(() => {
    // DO NOT REDIRECT if we are still processing a deep link
    if (loading || isProcessingDeepLink || isLoggingIn) return;

    const currentGroup = segments[0]
    const inAuthGroup = currentGroup === '(auth)'
    const inTabsGroup = currentGroup === '(tabs)'
    const isOtpScreen = segments[1] === 'otp-verify'
    
    // Log the current state for debugging
    console.log(`[AuthGate] State: ${session ? 'Logged In' : 'Logged Out'}, Group: ${currentGroup}, Verified: ${profile?.email_verified}`);

    // 1. If NOT loading and NO session, force to Onboarding (unless already in auth)
    if (!loading && !session && !isLoggingIn && !inAuthGroup && currentGroup !== 'auth') {
      console.log('[AuthGate] No session detected. Final catch: Redirecting to Onboarding...');
      router.replace('/(auth)/onboarding')
      return
    }

    // 2. If session exists, handle verification
    if (session) {
      const isGoogleUser = session?.user?.app_metadata?.provider === 'google' || 
                           session?.user?.identities?.some(id => id.provider === 'google');
      
      const isVerified = isGoogleUser || profile?.email_verified;

      // Force unverified non-google users to OTP
      if (!isVerified && !isOtpScreen && !inAuthGroup) {
         console.log('[AuthGate] User unverified, forcing OTP...');
         router.replace({ pathname: '/(auth)/otp-verify', params: { email: session.user.email } });
         return;
      }

      // If verified but stuck in Auth, go to Tabs
      if (isVerified && (inAuthGroup || currentGroup === 'auth' || !currentGroup)) {
        if (!inTabsGroup) {
          console.log('[AuthGate] Moving verified user to Tabs...');
          // Mark that we just logged in to avoid immediate pairing popups
          AsyncStorage.setItem('loqit_just_logged_in', 'true');
          router.replace('/(tabs)')
        }
      }
    }
  }, [loading, router, segments, session, profile, isLoggingIn])

  const [handsetIdentifier, setHandsetIdentifier] = useState<string | null>(null)

  useEffect(() => {
    let timerCleared = false;
    
    // Safety Fallback: If AsyncStorage hangs for the ID, don't block the whole app after 6s
    const fallbackTimer = setTimeout(() => {
      if (!timerCleared) {
        console.warn('[LOQIT-BOOT] Handset ID fetch hung. Using fallback.');
        setHandsetIdentifier(`hset-fallback-${Date.now()}`);
      }
    }, 2000);

    getHandsetIdentifier().then(id => {
      timerCleared = true;
      clearTimeout(fallbackTimer);
      setHandsetIdentifier(id);
    }).catch(err => {
      console.error('[LOQIT-BOOT] Handset ID fetch error:', err);
      setHandsetIdentifier(`hset-err-${Date.now()}`);
    });

    return () => {
      timerCleared = true;
      clearTimeout(fallbackTimer);
    };
  }, [])

  // Auto-scan is handled in bootstrapBleBackground with a 30s restart loop

  // Debug check for the exact reason for the loading screen
  if (loading || isLoggingIn || isProcessingDeepLink || !handsetIdentifier) {
    console.log(`[AuthGate] Initialising. Reason: loading=${loading}, loggingIn=${isLoggingIn}, deepLink=${isProcessingDeepLink}, handsetID=${!!handsetIdentifier}`);
    
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors?.primary || '#000'} />
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: Colors?.primary || '#000', fontFamily: FontFamily?.headingBold || 'System' }}>Initialising LOQIT Security...</Text>
          <Text style={{ color: Colors?.outline || '#888', fontSize: 10, marginTop: 8 }}>
            Status: {(isLoggingIn || isProcessingDeepLink) ? 'Syncing Profile...' : loading ? 'Checking Session...' : 'Verifying Hardware...'}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <PairingGate 
      handsetIdentifier={handsetIdentifier} 
      onPaired={(deviceId) => {
        console.log(`[LOQIT] Handset successfully paired with device: ${deviceId}`);
        bootstrapBleBackground();
      }}
    >
      <Slot />
      {lockScreenActive && lockDeviceId && (
        <LostDeviceLock
          deviceId={lockDeviceId}
          lockMessage={lockMessage}
          onUnlocked={() => setLockScreenActive(false)}
        />
      )}
    </PairingGate>
  )
}

export default function RootLayout() {
  const fontsLoaded = true 
  
  return (
    <ThemeProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})