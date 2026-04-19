import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GradientButton } from '../components/ui/GradientButton'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'
import { supabase } from '../lib/supabase'

type VerifyResult = {
  registered: boolean
  status?: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
  make?: string
  model?: string
  owner_masked?: string
}

function getResultVisual(result: VerifyResult | null) {
  if (!result) {
    return {
      title: '',
      subtitle: '',
      icon: 'help-outline' as keyof typeof MaterialIcons.glyphMap,
      tint: Colors.outline,
      bg: Colors.surfaceContainerHigh,
      border: Colors.outlineVariant,
    }
  }

  if (result.registered && result.status !== 'lost' && result.status !== 'stolen') {
    return {
      title: 'REGISTERED & CLEAN',
      subtitle: `${result.make || 'Unknown'} ${result.model || ''}`.trim(),
      icon: 'verified-user' as keyof typeof MaterialIcons.glyphMap,
      tint: Colors.secondary,
      bg: 'rgba(70,241,187,0.14)',
      border: Colors.secondary,
    }
  }

  if (result.registered && (result.status === 'lost' || result.status === 'stolen')) {
    return {
      title: 'LOST / STOLEN',
      subtitle: 'DO NOT PURCHASE — Reported Lost/Stolen',
      icon: 'warning' as keyof typeof MaterialIcons.glyphMap,
      tint: Colors.error,
      bg: 'rgba(255,78,78,0.14)',
      border: Colors.error,
    }
  }

  return {
    title: 'NOT FOUND',
    subtitle: 'Not registered in LOQIT — Verify carefully',
    icon: 'help-outline' as keyof typeof MaterialIcons.glyphMap,
    tint: Colors.tertiary,
    bg: 'rgba(255,185,95,0.16)',
    border: Colors.tertiary,
  }
}

export default function VerifyScreen() {
  const router = useRouter()

  const cardTranslate = useRef(new Animated.Value(16)).current
  const cardOpacity = useRef(new Animated.Value(0)).current

  const [imei, setImei] = useState('')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)

  const runResultAnimation = () => {
    cardTranslate.setValue(16)
    cardOpacity.setValue(0)

    Animated.parallel([
      Animated.timing(cardTranslate, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const verifyDevice = async () => {
    if (!imei.trim()) {
      Alert.alert('Invalid Serial', 'Enter a device serial number to verify this device.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('verify_serial', { p_serial: imei })
      if (error) {
        throw new Error(error.message)
      }

      const parsed = (data ?? { registered: false }) as VerifyResult
      setResult(parsed)
      runResultAnimation()
    } catch (error) {
      Alert.alert('Unable to verify', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const visual = getResultVisual(result)

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Verify a Device</Text>
          <View style={styles.headerSpace} />
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>Check if a second-hand phone is legally owned</Text>

          <TextInput
            style={styles.imeiInput}
            value={imei}
            placeholder="Enter Hardware Serial Number"
            placeholderTextColor={Colors.outline}
            onChangeText={(value) => setImei(value.toUpperCase())}
          />

          <GradientButton
            title={loading ? 'Checking...' : 'Check Device'}
            onPress={() => void verifyDevice()}
            loading={loading}
          />

          {result ? (
            <Animated.View
              style={[
                styles.resultCard,
                {
                  borderColor: visual.border,
                  backgroundColor: visual.bg,
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslate }],
                  shadowColor: visual.border,
                },
              ]}
            >
              <View style={styles.resultIconWrap}>
                <MaterialIcons name={visual.icon} size={24} color={visual.tint} />
              </View>

              <View style={styles.resultTextWrap}>
                <Text style={[styles.resultTitle, { color: visual.tint }]}>{visual.title}</Text>
                <Text style={styles.resultSubtitle}>{visual.subtitle}</Text>

                {result.registered && result.status !== 'lost' && result.status !== 'stolen' ? (
                  <Text style={styles.ownerText}>{`Owner: ${result.owner_masked || 'Hidden'}`}</Text>
                ) : null}
              </View>
            </Animated.View>
          ) : null}

          {loading ? <ActivityIndicator color={Colors.primary} style={styles.loader} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardWrap: {
    flex: 1,
  },
  headerRow: {
    height: 64,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 20,
  },
  headerSpace: {
    width: 36,
    height: 36,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 14,
  },
  subtitle: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
  imeiInput: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#0c0e13',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    color: Colors.onSurface,
    paddingHorizontal: 14,
    fontFamily: FontFamily.monoMedium,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  resultCard: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  resultIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  resultTextWrap: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 14,
  },
  resultSubtitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
  ownerText: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
  },
  loader: {
    marginTop: 6,
  },
})
