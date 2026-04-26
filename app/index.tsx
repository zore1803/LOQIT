import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
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
    <View style={styles.container}>
      <MaterialIcons name="shield" size={76} color={Colors.accent} />

      <MaskedView
        style={styles.gradientWrap}
        maskElement={<Text style={styles.logoText}>LOQIT</Text>}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.inversePrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={[styles.logoText, styles.hiddenText]}>LOQIT</Text>
        </LinearGradient>
      </MaskedView>

      <Text style={styles.subtitle}>Secure Phone Ownership & Recovery</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F14',
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
    color: Colors.onSurfaceVariant,
    fontSize: 11.5,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
})