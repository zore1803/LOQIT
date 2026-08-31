import { StyleSheet, View, Text, Pressable } from 'react-native'
import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Colors } from '../constants/colors'
import { AuthProvider, useAuth } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { LostDeviceLock } from '../components/loqit/LostDeviceLock'
import { StructuredLoader } from '../components/ui/StructuredLoader'
import { useLostDeviceMonitor } from '../hooks/useLostDeviceMonitor'

import { FontFamily } from '../constants/typography'
import * as Linking from 'expo-linking'
import { PairingGate } from '../components/loqit/PairingGate'
import { completeSessionFromUrl } from '../lib/authSession'

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

  const [forceHideBootstrapOverlay, setForceHideBootstrapOverlay] = useState(false)
  const [profileWaitExpired, setProfileWaitExpired] = useState(false)
  // Becomes true after the very first time auth settles. Used so the full-screen
  // overlay only appears on a genuine COLD boot (and explicit logins) — not on
  // every later session event (token refresh, app resume, profile reload).
  const [hasBootstrapped, setHasBootstrapped] = useState(false)

  // All "this physical device" monitoring (BLE bootstrap + scan, lost-beacon
  // broadcasting, GPS heartbeat, realtime status, lock screen) lives in this hook
  // so AuthGate can stay focused on auth + routing.
  const {
    lockScreenActive,
    lockDeviceId,
    lockMessage,
    dismissLock,
    rebootstrap,
  } = useLostDeviceMonitor(session)

  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false)

  // Process a login deep link: complete the Supabase session from the URL using
  // the shared helper, then wait briefly for the session to propagate.
  const handleLoginUrl = async (url: string) => {
    console.log('[AuthGate] Processing login URL directly...')
    setIsProcessingDeepLink(true)
    try {
      const result = await completeSessionFromUrl(url)
      if (result.status === 'error') {
        console.error('[AuthGate] Failed to complete session from URL:', result.error)
      } else if (result.status === 'no-credentials') {
        console.log('[AuthGate] No tokens found in URL.')
      } else {
        // completeSessionFromUrl awaits setSession/exchangeCodeForSession, so
        // the SDK already holds the session here; onAuthStateChange will sync
        // React state. No polling needed.
        console.log('[AuthGate] Session set successfully.')
      }
    } finally {
      setIsProcessingDeepLink(false)
    }
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
    if (!session || profile) {
      setProfileWaitExpired(false)
      return
    }

    if (loading || isLoggingIn || isProcessingDeepLink) {
      return
    }

    const timeout = setTimeout(() => {
      setProfileWaitExpired(true)
    }, 10000)

    return () => clearTimeout(timeout)
  }, [isLoggingIn, isProcessingDeepLink, loading, profile, session])

  useEffect(() => {
    // DO NOT REDIRECT if we are still processing a deep link
    if (loading || isProcessingDeepLink || isLoggingIn) return;

    const currentGroup = segments[0]
    const inAuthGroup = currentGroup === '(auth)'
    const inTabsGroup = currentGroup === '(tabs)'
    const isOtpScreen = segments[1] === 'otp-verify'
    
    // Log the current state for debugging
    console.log(`[AuthGate] State: ${session ? 'Logged In' : 'Logged Out'}, Group: ${currentGroup}, Verified: ${profile?.email_verified}`);

    // 1. If NOT loading and NO session, VERIFY with Supabase SDK before redirecting
    if (!loading && !session && !isLoggingIn && !inAuthGroup && currentGroup !== 'auth') {
      // CRITICAL: Don't blindly redirect. React state may be null due to component re-mount
      // while the SDK still has a valid session in AsyncStorage. Check the SDK first.
      supabase.auth.getSession().then(async ({ data: { session: sdkSession } }) => {
        if (sdkSession) {
          console.log('[AuthGate] React state lost session but SDK still has one! Forcing refresh...');
          // Force a refreshSession to trigger onAuthStateChange → restores React state + profile
          await supabase.auth.refreshSession();
          return;
        }
        // Only redirect if the SDK also confirms no session
        console.log('[AuthGate] SDK confirms no session. Redirecting to Onboarding...');
        router.replace('/(auth)/onboarding')
      });
      return
    }

    // 2. If session exists, handle verification
    if (session) {
      const isGoogleUser = session?.user?.app_metadata?.provider === 'google';

      if (!profile) {
        if (profileWaitExpired) {
          console.warn('[AuthGate] Session exists but no LOQIT profile was loaded after waiting. Returning to sign-in.');
          supabase.auth.signOut().finally(() => {
            router.replace('/(auth)/sign-in')
          })
          return;
        }

        console.log('[AuthGate] Session exists; waiting for profile before routing.');
        return;
      }
      
      const isVerified = isGoogleUser || profile?.email_verified;

      // Force unverified non-google users to OTP
      if (!isVerified && !isOtpScreen) {
         console.log('[AuthGate] User unverified, forcing OTP...');
         router.replace({ pathname: '/(auth)/otp-verify', params: { email: session.user.email } });
         return;
      }

      // If verified but stuck in Auth, go to Tabs
      if (isVerified && (inAuthGroup || currentGroup === 'auth' || !currentGroup)) {
        if (!inTabsGroup && !isProcessingDeepLink && !isLoggingIn) {
          console.log('[AuthGate] Moving verified user to Tabs...');
          AsyncStorage.setItem('loqit_just_logged_in', 'true');
          router.replace('/(tabs)')
        }
      }
    }
  }, [loading, router, segments, session, profile, isLoggingIn, isProcessingDeepLink, profileWaitExpired])

  const [handsetIdentifier, setHandsetIdentifier] = useState<string | null>(null)

  useEffect(() => {
    const getIdentity = async () => {
      try {
        const id = await getHandsetIdentifier()
        setHandsetIdentifier(id)
      } catch (error) {
        console.error('[AuthGate] Failed to get device identity:', error)
        setHandsetIdentifier('unknown-device')
      }
    }
    
    getIdentity()

    // Emergency Timeout: If device ID is still null after 5 seconds, use a fallback
    const safetyTimer = setTimeout(() => {
      if (!handsetIdentifier) {
        console.warn('[AuthGate] Handset ID hung. Using safety fallback.')
        setHandsetIdentifier(`hset-safe-${Date.now()}`)
      }
    }, 5000)

    return () => clearTimeout(safetyTimer)
  }, [])

  // Auto-scan is handled in bootstrapBleBackground with a 30s restart loop

  useEffect(() => {
    if (!loading && !isLoggingIn && !isProcessingDeepLink) {
      setForceHideBootstrapOverlay(false)
    }
  }, [loading, isLoggingIn, isProcessingDeepLink])

  // Mark the app as bootstrapped once auth has settled for the first time.
  useEffect(() => {
    if (!hasBootstrapped && !loading) {
      setHasBootstrapped(true)
    }
  }, [loading, hasBootstrapped])

  // Cold boot only: checking the stored session before we've ever settled.
  const waitingForInitialSession = !hasBootstrapped && loading && !session
  // Explicit user action: a login / deep-link handoff is in flight with no session yet.
  // This is the one case we still want to cover the screen AFTER bootstrap.
  const waitingForLoginCallback = (isLoggingIn || isProcessingDeepLink) && !session
  // Cold boot only: have a session but the device identity hasn't resolved yet.
  const waitingForDeviceIdentity = !hasBootstrapped && !!session && !handsetIdentifier
  const isLoadingState = !forceHideBootstrapOverlay && (
    waitingForInitialSession || waitingForLoginCallback || waitingForDeviceIdentity
  );

  return (
    <PairingGate 
      handsetIdentifier={handsetIdentifier || ''} 
      onPaired={(deviceId) => {
        console.log(`[LOQIT] Handset successfully paired with device: ${deviceId}`);
        rebootstrap();
      }}
    >
      <Slot />
      {lockScreenActive && lockDeviceId && (
        <LostDeviceLock
          deviceId={lockDeviceId}
          lockMessage={lockMessage}
          onUnlocked={dismissLock}
        />
      )}
      
      {isLoadingState && (
        <StructuredLoader
          overlay
          variant="app"
          colors={Colors}
          message={(isLoggingIn || isProcessingDeepLink) ? 'Syncing profile...' : loading ? 'Checking session...' : 'Preparing device...'}
        >
          <Pressable
            onPress={async () => {
              setForceHideBootstrapOverlay(true)
              const { data: { session: latestSession } } = await supabase.auth.getSession()
              const sessionEmail = latestSession?.user?.email
              if (latestSession && profile?.email_verified) { router.replace('/(tabs)') }
              else if (sessionEmail) { router.replace({ pathname: '/(auth)/otp-verify', params: { email: sessionEmail } }) }
              else { router.replace('/(auth)/onboarding') }
            }}
            style={styles.manualContinueButton}
          >
            <Text style={styles.manualContinueText}>
              App unresponsive? Continue manually
            </Text>
          </Pressable>
        </StructuredLoader>
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
  manualContinueButton: {
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#3D8EFF15',
    borderRadius: 12,
  },
  manualContinueText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    textAlign: 'center',
  },
})
