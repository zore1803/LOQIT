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
      setProfile(data as Profile)
    }
  }

  useEffect(() => {
    let isMounted = true

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession()
      
      if (error && error.message.toLowerCase().includes('refresh token')) {
        console.warn('AuthProvider: Invalid refresh token detected. Clearing local session...')
        await supabase.auth.signOut({ scope: 'local' })
      }

      if (data.session) {
        setSession(data.session)
        await loadProfile(data.session.user.id)
      }
      
      if (isMounted) setLoading(false)
    }

    void bootstrap()

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (nextSession) {
        setSession(nextSession)
        await loadProfile(nextSession.user.id)
      } else {
        setSession(null)
        setProfile(null)
      }
      
      if (!isLoggingIn) {
        setLoading(false)
      }
    })

    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.log('[Auth] Safety timeout reached. Forcing loading to false.');
        setLoading(false)
      }
    }, 2500)

    return () => {
      isMounted = false
      clearTimeout(safetyTimeout)
      data.subscription.unsubscribe()
    }
  }, [isLoggingIn])

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
            setIsLoggingIn(false); 
            setLoading(false); 
            return { error }; 
          }
          if (!data?.url) {
            console.error('[Auth-DEBUG] No redirect URL returned from Supabase')
            setIsLoggingIn(false); 
            setLoading(false); 
            return { error: new AuthError('No redirect URL returned') }; 
          }

          const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

          if (res.type === 'success') {
            const { url } = res
            const parsed = Linking.parse(url)
            
            let accessToken = parsed.queryParams?.access_token as string
            let refreshToken = parsed.queryParams?.refresh_token as string
            
            if (!accessToken && url.includes('#')) {
              const fragment = url.split('#')[1]
              const params = new URLSearchParams(fragment)
              accessToken = params.get('access_token') || ''
              refreshToken = params.get('refresh_token') || ''
            }

            if (accessToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              })
              
              if (sessionError) { setIsLoggingIn(false); setLoading(false); return { error: sessionError }; }
              
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                await supabase.from('profiles').update({ email_verified: true }).eq('id', user.id)
                await loadProfile(user.id)
              }
              setIsLoggingIn(false)
              setLoading(false)
              return { error: null }
            }
          }
          setIsLoggingIn(false)
          setLoading(false)
          return { error: null }
        } catch (err) {
          console.error('[Auth-DEBUG] Google Sign-In caught error:', err)
          setIsLoggingIn(false)
          setLoading(false)
          return { error: { name: 'AuthError', message: `Google Sign-In failed: ${err instanceof Error ? err.message : 'Unknown Error'}` } as any }
        }
      },
      verifyOtp: async (email, token) => {
        const normalizedEmail = email.trim().toLowerCase()
        try {
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
            throw new Error(result.message || 'Verification failed');
          }

          let activeSession = session;
          if (!activeSession) {
            const { data: sData } = await supabase.auth.getSession();
            activeSession = sData.session;
          }

          if (!activeSession && !tempUser) {
             return { error: { name: 'AuthError', message: 'Verification session expired.' } as any }
          }

          let userId = activeSession?.user?.id;
          if (!session && tempUser) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: tempUser.email.trim(),
              password: tempUser.password,
              options: { data: { full_name: tempUser.fullName, phone_number: tempUser.phoneNumber } },
            })
            if (signUpError && !signUpError.message.toLowerCase().includes('already registered')) throw signUpError;
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

          return { error: null }
        } catch (err) {
          console.error('[Auth] verifyOtp error:', err)
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
