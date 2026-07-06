import { useEffect, useState } from 'react'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { completeSessionFromUrl } from '../../lib/authSession'
import { Colors } from '../../constants/colors'
import { StructuredLoader } from '../../components/ui/StructuredLoader'

export default function AuthCallback() {
  const router = useRouter()
  const { session, profile, loading } = useAuth()
  const [message, setMessage] = useState('Securing LOQIT Connection...')

  useEffect(() => {
    let cancelled = false

    const completeOAuth = async () => {
      const url = await Linking.getInitialURL()
      if (!url) return
      const result = await completeSessionFromUrl(url)
      if (result.status === 'error') {
        console.error('[AuthCallback] OAuth completion failed:', result.error)
      }
    }

    void completeOAuth()

    const fallback = setTimeout(async () => {
      if (cancelled) return
      const { data: { session: latestSession } } = await supabase.auth.getSession()
      if (!latestSession) {
        router.replace('/(auth)/sign-in')
        return
      }

      const { data: latestProfile, error } = await db
        .from('profiles')
        .select('id, email_verified')
        .eq('id', latestSession.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('[AuthCallback] Profile lookup failed:', error)
        setMessage('Unable to load your LOQIT profile. Please sign in again.')
        setTimeout(() => router.replace('/(auth)/sign-in'), 1200)
        return
      }

      if (latestProfile) {
        const isGoogleUser = latestSession.user.app_metadata?.provider === 'google'
          || latestSession.user.identities?.some(identity => identity.provider === 'google')

        if (isGoogleUser || latestProfile.email_verified) {
          router.replace('/(tabs)')
        } else if (latestSession.user.email) {
          router.replace({ pathname: '/(auth)/otp-verify', params: { email: latestSession.user.email } })
        }
        return
      }

      console.warn(`[AuthCallback] No LOQIT profile exists for OAuth user ${latestSession.user.id} (${latestSession.user.email || 'unknown email'}).`)
      await supabase.auth.signOut()
      setMessage('No LOQIT account is linked with this Google email.')
      setTimeout(() => router.replace('/(auth)/sign-in'), 1600)
    }, 2500)

    return () => {
      cancelled = true
      clearTimeout(fallback)
    }
  }, [router])

  useEffect(() => {
    if (loading || !session) return

    const isGoogleUser = session.user.app_metadata?.provider === 'google'
      || session.user.identities?.some(identity => identity.provider === 'google')

    if (profile && (isGoogleUser || profile.email_verified)) {
      router.replace('/(tabs)')
    } else if (session.user.email) {
      if (isGoogleUser) {
        setMessage('No LOQIT account is linked with this Google email.')
        supabase.auth.signOut().finally(() => {
          setTimeout(() => router.replace('/(auth)/sign-in'), 1200)
        })
      } else {
        router.replace({ pathname: '/(auth)/otp-verify', params: { email: session.user.email } })
      }
    }
  }, [loading, profile, router, session])

  return (
    <StructuredLoader
      colors={Colors}
      variant="app"
      message={message}
    />
  )
}
