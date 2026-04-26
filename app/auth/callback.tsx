import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../hooks/useAuth'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'

export default function AuthCallback() {
  const router = useRouter()
  const { session } = useAuth()

  useEffect(() => {
    // If the session popped into existence (via AuthGate's global listener), 
    // simply push the user to the dashboard.
    if (session) {
      setTimeout(() => {
        router.replace('/(tabs)')
      }, 500)
    }
  }, [session, router])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Securing LOQIT Connection...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    marginTop: 20,
    fontFamily: FontFamily.bodyMedium,
    color: Colors.onSurface,
  }
})
