import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthError, Session, User } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

import { supabase } from '../lib/supabase'

WebBrowser.maybeCompleteAuthSession()

export type Profile = {
  id: string
  full_name: string
  phone_number: string | null
  aadhaar_hash: string | null
  aadhaar_verified: boolean
  email_verified: boolean
  role: 'civilian' | 'police' | 'admin'
  avatar_url: string | null
  created_at: string
  updated_at: string
}

type SignUpPayload = {
  email: string
  password: string
  fullName: string
  phoneNumber: string
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isLoggingIn: boolean
  signUp: (payload: SignUpPayload) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>
  resendOtp: (email: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  getTempUser: () => SignUpPayload | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [tempUser, setTempUser] = useState<SignUpPayload | null>(null)
  const profileRef = useRef<Profile | null>(null)
  const authGenerationRef = useRef(0)
  const explicitSignOutRef = useRef(false)
  const profileLoadRequestIdRef = useRef(0)
  const loadingProfileUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const loadProfile = async (userId: string, generation = authGenerationRef.current) => {
    const profileLoadKey = `${generation}:${userId}`
    if (loadingProfileUserIdRef.current === profileLoadKey) {
      console.log('[Auth] Profile load already in progress. Waiting for existing request.')
      return
    }

    loadingProfileUserIdRef.current = profileLoadKey
    const requestId = ++profileLoadRequestIdRef.current
    const canApplyProfile = () => (
      requestId === profileLoadRequestIdRef.current &&
      generation === authGenerationRef.current &&
      !explicitSignOutRef.current
    )

    try {
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(),
        15000,
      'Profile load'
    )

    if (error) {
      console.error('[Auth] Profile load error:', error)
      if (canApplyProfile() && !profileRef.current) {
        setProfile(null)
      }
      return
    }

    if (data) {
      if (!canApplyProfile()) return
      console.log(`[Auth] Profile loaded successfully. Role: ${data.role}`);
      setProfile(data as Profile)
      profileRef.current = data as Profile
    } else {
      // No profile row exists — this happens on first-time Google OAuth sign-in.
    const { data: { user: currentUser } } = await withTimeout(
      supabase.auth.getUser(),
        8000,
      'Auth user load'
      )
      console.warn(`[Auth] No LOQIT profile found for auth user ${userId} (${currentUser?.email || 'unknown email'}). Refusing fallback dashboard.`);
      if (canApplyProfile() && !profileRef.current) {
        setProfile(null)
      }
      return
    }
    } catch (error) {
      console.log('[Auth] Profile load timed out or failed:', error)
      if (canApplyProfile() && !profileRef.current) {
        setProfile(null)
      }
    } finally {
      if (loadingProfileUserIdRef.current === profileLoadKey) {
        loadingProfileUserIdRef.current = null
      }
    }
  }

  useEffect(() => {
    let isMounted = true

    const bootstrap = async () => {
      const generation = authGenerationRef.current
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error && error.message.toLowerCase().includes('refresh token')) {
          console.warn('AuthProvider: Invalid refresh token detected. Clearing local session...')
          await supabase.auth.signOut({ scope: 'local' })
        }

        if (data.session && isMounted && generation === authGenerationRef.current && !explicitSignOutRef.current) {
          setSession(data.session)
          await loadProfile(data.session.user.id, generation)
        }
      } catch (err) {
        console.error('[Auth] Bootstrap error:', err)
      } finally {
        if (isMounted) {
          console.log('[Auth] Bootstrap complete. Setting loading=false')
          setLoading(false)
        }
      }
    }

    void bootstrap()

    let lastSignInAt = 0;
    const { data } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      console.log(`[Auth] onAuthStateChange: event=${event}, hasSession=${!!nextSession}`)

      if (nextSession && explicitSignOutRef.current) {
        console.warn('[Auth] Ignoring session event while explicit sign out is in progress.')
        profileLoadRequestIdRef.current += 1
        loadingProfileUserIdRef.current = null
        setSession(null)
        setProfile(null)
        profileRef.current = null
        return
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        lastSignInAt = Date.now();
        explicitSignOutRef.current = false
      }
      
      if (nextSession) {
        const generation = authGenerationRef.current
        setSession(nextSession)
        await loadProfile(nextSession.user.id, generation)
        setIsLoggingIn(false)
        setLoading(false)
      } else {
        if (explicitSignOutRef.current) {
          console.log('[Auth] Explicit SIGNED_OUT. Clearing session.');
          profileLoadRequestIdRef.current += 1
          loadingProfileUserIdRef.current = null
          setSession(null)
          setProfile(null)
          profileRef.current = null
          setIsLoggingIn(false)
          setLoading(false)
          explicitSignOutRef.current = false
          return
        }

        // CRITICAL: Block phantom SIGNED_OUT events. The SDK can emit these while a
        // browser OAuth handoff or token refresh is still settling.
        const timeSinceSignIn = Date.now() - lastSignInAt;
        const { data: { session: recoveredSession } } = await supabase.auth.getSession();
        if (recoveredSession && (lastSignInAt === 0 || timeSinceSignIn < 30000)) {
          console.warn(`[Auth] Suppressing phantom SIGNED_OUT (${lastSignInAt > 0 ? `${timeSinceSignIn}ms after sign-in` : 'SDK still has session'}). Recovering session...`);
          const generation = authGenerationRef.current
          setSession(recoveredSession);
          await loadProfile(recoveredSession.user.id, generation)
          setIsLoggingIn(false)
          setLoading(false)
          return;
        }
        console.log('[Auth] Genuine SIGNED_OUT. Clearing session.');
        profileLoadRequestIdRef.current += 1
        loadingProfileUserIdRef.current = null
        setSession(null)
        setProfile(null)
        profileRef.current = null
        setIsLoggingIn(false)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Safety net: If session exists but profile is null (e.g. after a component re-mount
  // where the SDK recovered the session but onAuthStateChange didn't re-fire),
  // actively load the profile.
  useEffect(() => {
    if (session?.user?.id && !profile && !loading) {
      console.log('[Auth] Session exists but profile is null. Loading profile...');
      loadProfile(session.user.id);
    }
  }, [session, profile, loading])

  // Independent safety timeout - guaranteed to fire even if bootstrap hangs
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      console.warn('[Auth] Safety timeout: forcing loading=false')
      setLoading(false)
    }, 5000)
    return () => clearTimeout(safetyTimeout)
  }, [])

  useEffect(() => {
    const saveTempUser = async () => {
      if (tempUser) {
        await AsyncStorage.setItem('loqit-pending-registration', JSON.stringify(tempUser))
      } else {
        await AsyncStorage.removeItem('loqit-pending-registration')
      }
    }
    saveTempUser()
  }, [tempUser])

  useEffect(() => {
    const loadPending = async () => {
      const pending = await AsyncStorage.getItem('loqit-pending-registration')
      if (pending && !tempUser) {
        try {
          setTempUser(JSON.parse(pending))
        } catch (e) {
          console.error('[Auth] Failed to load pending registration', e)
        }
      }
    }
    loadPending()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isLoggingIn,
      signUp: async ({ email, password, fullName, phoneNumber }) => {
        const cleanEmail = email.trim().toLowerCase()
        setTempUser({ email: cleanEmail, password, fullName, phoneNumber })

        try {
          const generation = authGenerationRef.current + 1
          authGenerationRef.current = generation
          explicitSignOutRef.current = false
          setIsLoggingIn(true)
          setLoading(true)

          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { full_name: fullName, phone_number: phoneNumber } },
          })

          if (error && !error.message.toLowerCase().includes('already registered')) {
            return { error: error as any }
          }

          const userId = data.user?.id
          if (userId) {
            await supabase.from('profiles').update({ email_verified: true }).eq('id', userId)
          }

          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })

          if (signInError) {
            return { error: signInError as any }
          }

          setTempUser(null)
          if (signInData.session) {
            setSession(signInData.session)
            await loadProfile(signInData.session.user.id, generation)
          }
        } catch (err) {
          console.error('[Auth] signUp error:', err)
          return { error: { name: 'AuthError', message: err instanceof Error ? err.message : 'Unable to create account.' } as any }
        } finally {
          setIsLoggingIn(false)
          setLoading(false)
        }

        return { error: null }
      },
      signIn: async (email, password) => {
        const generation = authGenerationRef.current + 1
        authGenerationRef.current = generation
        explicitSignOutRef.current = false
        setIsLoggingIn(true)
        setLoading(true)
        try {
          const cleanEmail = email.trim().toLowerCase()
          loadingProfileUserIdRef.current = null
          profileLoadRequestIdRef.current += 1
          setSession(null)
          setProfile(null)
          profileRef.current = null
          await AsyncStorage.multiRemove([
            'loqit_my_active_device_id',
            'loqit_ble_broadcasting_mode',
            'loqit_ble_device_uuid',
            'loqit_just_logged_in',
          ])
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})

          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })

          if (error) {
            return { error: error as any }
          }
          
          if (data.session) {
            setSession(data.session)
          }

          if (data.user) {
            await loadProfile(data.user.id, generation)
          }

          return { error: null }
        } catch (err) {
          console.error('[Auth] signIn error:', err)
          return { error: { name: 'AuthError', message: err instanceof Error ? err.message : 'Unable to sign in.' } as any }
        } finally {
          setIsLoggingIn(false)
          setLoading(false)
        }
      },
      signInWithGoogle: async () => {
        try {
          const generation = authGenerationRef.current + 1
          authGenerationRef.current = generation
          explicitSignOutRef.current = false
          setIsLoggingIn(true)
          setLoading(true)
          loadingProfileUserIdRef.current = null
          profileLoadRequestIdRef.current += 1
          setSession(null)
          setProfile(null)
          profileRef.current = null
          await AsyncStorage.multiRemove([
            'loqit_my_active_device_id',
            'loqit_ble_broadcasting_mode',
            'loqit_ble_device_uuid',
            'loqit_just_logged_in',
          ])
          const redirectUrl = Linking.createURL('auth/callback')
          console.log('[Auth-DEBUG] Google Redirect URL:', redirectUrl)
          
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { 
              redirectTo: redirectUrl, 
              queryParams: { access_type: 'offline', prompt: 'consent' }
            },
          })

          if (error) {
            console.error('[Auth-DEBUG] Google Sign-In Error:', error)
            setIsLoggingIn(false); setLoading(false);
            return { error }; 
          }

          if (!data?.url) {
            setIsLoggingIn(false); setLoading(false);
            return { error: new AuthError('No redirect URL returned') }; 
          }

          const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
          console.log('[Auth-DEBUG] Browser result type:', res.type)

          // On Android, the browser can return 'success', 'dismiss', OR 'cancel'
          // In ALL cases, we should poll for a session because the deep link handler
          // in _layout.tsx may have already set it (or will set it momentarily)
          let attempts = 0;
          while (attempts < 50) { // 5 seconds total
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession) {
              console.log('[Auth-DEBUG] Session found after polling!')
              setSession(currentSession);
              await loadProfile(currentSession.user.id, generation);
              setIsLoggingIn(false); setLoading(false);
              return { error: null };
            }
            await new Promise(r => setTimeout(r, 100));
            attempts++;
          }
          
          console.log('[Auth-DEBUG] Polling timed out. Session may still arrive via deep link.')
          setIsLoggingIn(false)
          setLoading(false)
          return { error: null }
        } catch (err) {
          console.error('[Auth-DEBUG] Google Sign-In caught error:', err)
          setIsLoggingIn(false); setLoading(false);
          return { error: { name: 'AuthError', message: `Google Sign-In failed: ${err instanceof Error ? err.message : 'Unknown Error'}` } as any }
        }
      },
      verifyOtp: async (email, _token) => {
        const normalizedEmail = email.trim().toLowerCase()
        try {
          const generation = authGenerationRef.current
          setIsLoggingIn(true)
          setLoading(true)

          let activeSession = session;
          if (!activeSession) {
            const { data: sData } = await supabase.auth.getSession();
            activeSession = sData.session;
          }

          if (!activeSession && !tempUser) {
             setIsLoggingIn(false)
             setLoading(false)
             return { error: { name: 'AuthError', message: 'Verification session expired.' } as any }
          }

          let userId = activeSession?.user?.id;
          if (!session && tempUser) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: tempUser.email.trim(),
              password: tempUser.password,
              options: { data: { full_name: tempUser.fullName, phone_number: tempUser.phoneNumber } },
            })
            if (signUpError && !signUpError.message.toLowerCase().includes('already registered')) {
              setIsLoggingIn(false); setLoading(false);
              throw signUpError;
            }
            userId = signUpData?.user?.id;
          }

          if (!userId) {
            const { data: userData } = await supabase.from('profiles').select('id').eq('email', normalizedEmail).single()
            userId = userData?.id
          }

          if (userId) {
            await supabase.from('profiles').update({ email_verified: true }).eq('id', userId)
            await loadProfile(userId, generation)
          }

          setTempUser(null)
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData.session) {
            setSession(sessionData.session)
            await loadProfile(sessionData.session.user.id, generation)
          }

          // Wait a tiny bit for the state to propagate
          await new Promise(r => setTimeout(r, 500));
          setIsLoggingIn(false)
          setLoading(false)
          return { error: null }
        } catch (err) {
          console.error('[Auth] verifyOtp error:', err)
          setIsLoggingIn(false)
          setLoading(false)
          return { error: { name: 'AuthError', message: 'System error.' } as any }
        }
      },
      resendOtp: async (email) => {
        return { error: null }
      },
      signOut: async () => {
        const generation = authGenerationRef.current + 1
        authGenerationRef.current = generation
        explicitSignOutRef.current = true
        setIsLoggingIn(false)
        setLoading(true)
        profileLoadRequestIdRef.current += 1
        loadingProfileUserIdRef.current = null
        setSession(null)
        setProfile(null)
        profileRef.current = null
        await AsyncStorage.multiRemove([
          'loqit_my_active_device_id',
          'loqit_ble_broadcasting_mode',
          'loqit_ble_device_uuid',
          'loqit_just_logged_in',
        ])
        try {
          await withTimeout(supabase.auth.signOut(), 8000, 'Sign out')
        } catch (error) {
          console.warn('[Auth] Remote sign out failed or timed out. Clearing local session.', error)
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        } finally {
          if (authGenerationRef.current === generation) {
            setSession(null)
            setProfile(null)
            profileRef.current = null
            setIsLoggingIn(false)
            setLoading(false)
          }
          explicitSignOutRef.current = false
        }
      },
      refreshProfile: async () => {
        const nextUserId = session?.user?.id
        if (!nextUserId) { setProfile(null); return; }
        const { data, error } = await supabase.from('profiles').select('*').eq('id', nextUserId).maybeSingle()
        if (!error && data) setProfile(data as Profile)
      },
      getTempUser: () => tempUser,
    }),
    [loading, profile, session, tempUser, isLoggingIn]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
