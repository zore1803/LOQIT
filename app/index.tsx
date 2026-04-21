import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import MaskedView from '@react-native-masked-view/masked-view'

import { useAuth } from '../hooks/useAuth'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'

export default function SplashScreen() {
  const router = useRouter()
  const { session, loading } = useAuth()

  // Navigation is handled globally by AuthGate in _layout.tsx

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <MaterialIcons name="shield" size={76} color={Colors.primary} />

      <MaskedView
        style={styles.gradientWrap}
        maskElement={<Text style={[styles.logoText, { color: Colors.onSurface }]}>LOQIT</Text>}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.inversePrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={[styles.logoText, styles.hiddenText]}>LOQIT</Text>
        </LinearGradient>
      </MaskedView>

      <Text style={[styles.subtitle, { color: Colors.onSurfaceVariant }]}>Secure Phone Ownership & Recovery</Text>
      
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={{ 
          marginTop: 10, 
          fontSize: 10, 
          color: Colors.outline, 
          fontFamily: FontFamily.bodyRegular,
          letterSpacing: 1
        }}>
          INITIALIZING...
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  gradientWrap: {
    marginTop: 12,
  },
  logoText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 56,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  hiddenText: {
    opacity: 0,
  },
  subtitle: {
    marginTop: 14,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11.5,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
})