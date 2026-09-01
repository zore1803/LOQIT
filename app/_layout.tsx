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
import { BootScreen } from '../components/ui/BootScreen'
import { useLostDeviceMonitor } from '../hooks/useLostDeviceMonitor'

import { FontFamily } from '../constants/typography'
import * as Linking from 'expo-linking'
import { PairingGate } from '../components/loqit/PairingGate'
import { completeSessionFromUrl } from '../lib/authSession'

// Side-effect imports for task registration
import '../services/backgroundBleTask'
import '../services/protectionTask'
import '../services/lostTrackingTask'

// Render's free tier sleeps after ~15 minutes idle and takes 30-60s to wake on
// the first request. Ping it the instant the JS bundle loads (before the user
// even reaches a login button) so the wake-up overlaps with app startup and
// whatever the user does before their first real network call, instead of
// happening cold in the middle of sign-in.
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000').replace(/\/$/, '')
void fetch(`${API_URL}/health`).catch(() => {
  // Best-effort only — a failed wake-up ping isn't itself an error, the real
  // request later will surface any actual connectivity problem.
})

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
  const { session, loading, profile, isLoggingIn, refreshProfile } = useAuth()
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

    // Render's free tier can take 30-60s to wake from a cold start, and the
    // profile fetch is the first authenticated request after sign-in — it can
    // land squarely in that window. One retry partway through (instead of a
    // single fixed deadline) means a slow-but-alive server gets a second
    // chance before we give up and sign the user back out.
    const retry = setTimeout(() => {
      console.log('[AuthGate] Profile still not loaded after 15s — retrying once before giving up.')
      refreshProfile().catch(() => {})
    }, 15000)

    const giveUp = setTimeout(() => {
      setProfileWaitExpired(true)
    }, 45000)

    return () => {
      clearTimeout(retry)
      clearTimeout(giveUp)
    }
  }, [isLoggingIn, isProcessingDeepLink, loading, profile, session, refreshProfile])

  useEffect(() => {
    // DO NOT REDIRECT if we are still processing a deep link
    if (loading || isProcessingDeepLink || isLoggingIn) return;

    const currentGroup = segments[0]
    // Expo Router transiently reports empty segments mid-navigation. Treating
    // that as a real location made the redirect below re-fire, which caused
    // another transient empty, which fired it again — the app replaced itself
    // into (tabs) three times on every launch, and each replace resets the
    // navigator, showing up as a blank flash. Routing decisions need a settled
    // location; app/index.tsx handles the genuine bare-`/` case with a Redirect.
    if (!currentGroup) return
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
      if (isVerified && (inAuthGroup || currentGroup === 'auth')) {
        if (!inTabsGroup && !isProcessingDeepLink && !isLoggingIn) {
          console.log('[AuthGate] Moving verified user to Tabs...');
          AsyncStorage.setItem('loqit_just_logged_in', 'true');
          router.replace('/(tabs)')
        }
      }
    }
  }, [loading, router, segments, session, profile, isLoggingIn, isProcessingDeepLink, profileWaitExpired])

  const [handsetIdentifier, setHandsetIdentifier] = useState<string | null>(null)
  // PairingGate no longer renders its own full-screen loader — it reports its
  // loading state here instead, so it folds into the one boot screen below.
  const [pairingLoading, setPairingLoading] = useState(true)

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

    // Emergency Timeout: If device ID is still null after 5 seconds, use a fallback.
    // The check must happen inside the state updater — this effect runs once with
    // [] deps, so its closure captures handsetIdentifier as null permanently and
    // the old `if (!handsetIdentifier)` was ALWAYS true. That overwrote the real,
    // already-resolved ID with a throwaway one on every single launch, which in
    // turn re-triggered PairingGate and blanked the navigator.
    const safetyTimer = setTimeout(() => {
      setHandsetIdentifier((current) => {
        if (current) return current
        console.warn('[AuthGate] Handset ID hung. Using safety fallback.')
        return `hset-safe-${Date.now()}`
      })
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

  // Latches true the first time we actually land inside the app. Used so the
  // boot overlay can stay up across the whole "session exists but we haven't
  // reached (tabs) yet" window — during which the (auth) onboarding screen is
  // really mounted and would otherwise be visible for the ~1s the profile
  // fetch takes — without ever re-covering the screen later when the user
  // navigates to a non-tab route like /settings.
  const [hasEnteredApp, setHasEnteredApp] = useState(false)
  useEffect(() => {
    if (segments[0] === '(tabs)') setHasEnteredApp(true)
  }, [segments])

  // Re-arm on sign-out. Without this the latch stays true for the life of the
  // JS runtime, so a sign-out followed by a sign-in (Google included) left the
  // whole sign-in -> dashboard window uncovered and the (auth) screens showed
  // through mid-transition.
  useEffect(() => {
    if (!session) setHasEnteredApp(false)
  }, [session])

  // A signed-in user who is on their way into the app but hasn't arrived yet.
  // Google users are verified implicitly; everyone else needs email_verified.
  const isHeadedIntoApp = !!session && (
    session.user?.app_metadata?.provider === 'google' || !profile || !!profile.email_verified
  )
  const waitingForFirstRoute = !hasEnteredApp && isHeadedIntoApp && !profileWaitExpired

  // Cold boot only: checking the stored session before we've ever settled.
  const waitingForInitialSession = !hasBootstrapped && loading && !session
  // Explicit user action: a login / deep-link handoff is in flight with no session yet.
  // This is the one case we still want to cover the screen AFTER bootstrap.
  const waitingForLoginCallback = (isLoggingIn || isProcessingDeepLink) && !session
  // Cold boot only: have a session but the device identity hasn't resolved yet.
  const waitingForDeviceIdentity = !hasBootstrapped && !!session && !handsetIdentifier
  // Cold boot / login only: session exists but PairingGate is still deciding
  // whether this handset is already linked to one of the user's devices.
  const waitingForPairingCheck = !hasBootstrapped && !!session && !!handsetIdentifier && pairingLoading
  const isLoadingState = !forceHideBootstrapOverlay && (
    waitingForInitialSession || waitingForLoginCallback || waitingForDeviceIdentity ||
    waitingForPairingCheck || waitingForFirstRoute
  );

  // One continuous stage number drives a single progress bar instead of four
  // different screens/messages swapping in and out as each piece of state
  // settles — checking session -> waiting for profile -> resolving this
  // handset's identity -> checking device pairing -> done.
  const bootStage = !session ? 0
    : !profile ? 1
    : !handsetIdentifier ? 2
    : pairingLoading ? 3
    : 4
  const bootStageMessage = [
    'Checking session…',
    'Loading your profile…',
    'Preparing this device…',
    'Checking device pairing…',
    'Ready',
  ][bootStage]

  return (
    <PairingGate 
      handsetIdentifier={handsetIdentifier || ''} 
      onPaired={(deviceId) => {
        console.log(`[LOQIT] Handset successfully paired with device: ${deviceId}`);
        rebootstrap();
      }}
      onLoadingChange={setPairingLoading}
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
        <View style={StyleSheet.absoluteFill}>
          <BootScreen message={bootStageMessage} progress={bootStage / 4}>
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
          </BootScreen>
        </View>
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
