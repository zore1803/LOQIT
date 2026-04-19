import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'

/**
 * Empty route to handle the redirect URL from OAuth.
 * This prevents the "Unmatched Route" error in Expo Router.
 */
export default function AuthCallback() {
  const router = useRouter()
  const url = Linking.useURL()
  const [hasProcessed, setHasProcessed] = useState(false)

  useEffect(() => {
    const handleUrl = async (currentUrl: string) => {
      console.log('[AuthCallback] Processing URL:', currentUrl)
      
      const parsed = Linking.parse(currentUrl)
      let accessToken = parsed.queryParams?.access_token as string
      let refreshToken = parsed.queryParams?.refresh_token as string

      if (!accessToken && currentUrl.includes('#')) {
        const fragment = currentUrl.split('#')[1]
        const params = new URLSearchParams(fragment)
        accessToken = params.get('access_token') || ''
        refreshToken = params.get('refresh_token') || ''
      }

      if (accessToken) {
        console.log('[AuthCallback] Session found, setting session...')
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })
        if (error) {
          console.error('[AuthCallback] setSession error:', error)
          router.replace('/(auth)/onboarding')
        } else {
          router.replace('/(tabs)')
        }
      } else {
        console.log('[AuthCallback] No tokens in URL.')
        // If we land here without tokens, wait a tiny bit then fallback
        setTimeout(() => router.replace('/'), 1000)
      }
    }

    if (url) {
      handleUrl(url)
    }
  }, [url, router])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
