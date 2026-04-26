import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AuthError, Session, User } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra as any) || {}
const N8N_SEND_URL = extra.n8nSendUrl || 'https://zore1803.app.n8n.cloud/webhook/send-verification'
const N8N_VERIFY_URL = extra.n8nVerifyUrl || 'https://zore1803.app.n8n.cloud/webhook/verify-otp'

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

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [tempUser, setTempUser] = useState<SignUpPayload | null>(null)

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[Auth] Profile load error:', error)
      return
    }

    if (data) {
      console.log(`[Auth] Profile loaded successfully. Role: ${data.role}`);
      setProfile(data as Profile)
    } else {
      // No profile row exists — this happens on first-time Google OAuth sign-in.
      // Auto-create one from the user's Google metadata.
      console.log('[Auth] No profile found. Attempting to create from user metadata...');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const meta = user.user_metadata || {};
          const newProfile = {
            id: userId,
            full_name: meta.full_name || meta.name || user.email?.split('@')[0] || 'User',
            phone_number: meta.phone || null,
            aadhaar_hash: null,
            aadhaar_verified: false,
            email_verified: true, // Google users are inherently email-verified
            role: 'civilian' as const,
            avatar_url: meta.avatar_url || meta.picture || null,
          };
          
          const { data: created, error: createError } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id' })
            .select()
            .single();
            
          if (createError) {
            console.error('[Auth] Profile creation error:', createError);
          } else if (created) {
            console.log(`[Auth] Profile auto-created for Google user. Role: ${created.role}`);
            setProfile(created as Profile);
          }
        }
      } catch (e) {
        console.error('[Auth] Profile auto-creation failed:', e);
      }
    }
  }

  useEffect(() => {
    let isMounted = true

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error && error.message.toLowerCase().includes('refresh token')) {
          console.warn('AuthProvider: Invalid refresh token detected. Clearing local session...')
          await supabase.auth.signOut({ scope: 'local' })
        }

        if (data.session) {
          setSession(data.session)
          await loadProfile(data.session.user.id)
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
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        lastSignInAt = Date.now();
      }
      
      if (nextSession) {
        setSession(nextSession)
        await loadProfile(nextSession.user.id)
      } else {
        // CRITICAL: Block phantom SIGNED_OUT events that fire within 10s of a SIGNED_IN.
        // This is a known gotrue-js race condition when setSession() is called externally
        // while the SDK's internal token refresh cycle is mid-flight.
        const timeSinceSignIn = Date.now() - lastSignInAt;
        if (timeSinceSignIn < 10000 && lastSignInAt > 0) {
          console.warn(`[Auth] Suppressing phantom SIGNED_OUT (${timeSinceSignIn}ms after sign-in). Recovering session...`);
          // Re-fetch the actual session from storage to confirm
          const { data: { session: recoveredSession } } = await supabase.auth.getSession();
          if (recoveredSession) {
            console.log('[Auth] Session recovered successfully! Ignoring false SIGNED_OUT.');
            setSession(recoveredSession);
            return;
          }
        }
        console.log('[Auth] Genuine SIGNED_OUT. Clearing session.');
        setSession(null)
        setProfile(null)
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
          const n8nUrl = process.env.EXPO_PUBLIC_N8N_SEND_VERIFICATION_URL || N8N_SEND_URL
          const res = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail }),
          })
          
          if (!res.ok) throw new Error('Verification service unreachable')
        } catch (err) {
          console.error('[Auth-DEBUG] n8n fetch error details:', err)
          return { error: { name: 'AuthError', message: `Verification failed: ${err instanceof Error ? err.message : 'Network Error'}` } as any }
        }

        return { error: null }
      },
      signIn: async (email, password) => {
        const cleanEmail = email.trim().toLowerCase()
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })
        
        if (!error && data.user) {
          const { data: profileData } = await supabase.from('profiles').select('email_verified').eq('id', data.user.id).maybeSingle()
          if (!profileData || !profileData.email_verified) {
            const n8nUrl = process.env.EXPO_PUBLIC_N8N_SEND_VERIFICATION_URL || N8N_SEND_URL
            if (n8nUrl) {
              fetch(n8nUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail }),
              }).catch(e => console.error('[Auth] Initial OTP trigger failed:', e))
            }
          }
        }

        return { error: error as any }
      },
      signInWithGoogle: async () => {
        try {
          setIsLoggingIn(true)
          setLoading(true)
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
              await loadProfile(currentSession.user.id);
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
      verifyOtp: async (email, token) => {
        const normalizedEmail = email.trim().toLowerCase()
        try {
          setIsLoggingIn(true)
          setLoading(true)
          const verifyUrl = process.env.EXPO_PUBLIC_N8N_VERIFY_OTP_URL || N8N_VERIFY_URL
          const response = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, otp: token }),
          });

          const text = await response.text();
          let result: any = {};
          try {
            result = text ? JSON.parse(text) : {};
          } catch (e) {
            if (text && text.toLowerCase().includes('verified')) {
              result = { status: 'verified' };
            } else {
               throw new Error('Verification failed');
            }
          }

          if (!response.ok || (result.status !== 'verified' && result.code !== 'verified')) {
            setIsLoggingIn(false)
            setLoading(false)
            throw new Error(result.message || 'Verification failed');
          }

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
            await loadProfile(userId)
          }

          setTempUser(null)
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData.session) {
            setSession(sessionData.session)
            await loadProfile(sessionData.session.user.id)
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
        try {
          const n8nUrl = process.env.EXPO_PUBLIC_N8N_SEND_VERIFICATION_URL || N8N_SEND_URL
          await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() }),
          })
          return { error: null }
        } catch (err) {
          console.error('[Auth-DEBUG] resendOtp fetch error:', err)
          return { error: { name: 'AuthError', message: `Resend failed: ${err instanceof Error ? err.message : 'Network Error'}` } as any }
        }
      },
      signOut: async () => {
        setSession(null)
        setProfile(null)
        await supabase.auth.signOut({ scope: 'local' })
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
