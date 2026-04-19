import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../lib/supabase'
import { FontFamily } from '../../constants/typography'

const PASSKEY_STORAGE_KEY = 'loqit_device_passkey_hash'
const PASSKEY_HINT_KEY = 'loqit_device_passkey_hint'

function simpleHash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

export async function setDevicePasskey(pin: string, hint: string, deviceId: string): Promise<void> {
  const salted = pin + deviceId
  const hashed = simpleHash(salted)
  await AsyncStorage.setItem(PASSKEY_STORAGE_KEY, hashed)
  await AsyncStorage.setItem(PASSKEY_HINT_KEY, hint)
  await supabase
    .from('protection_settings')
    .upsert({ device_id: deviceId, loqit_passkey_hash: hashed, passkey_hint: hint }, { onConflict: 'device_id' })
}

export async function verifyDevicePasskey(pin: string, deviceId: string): Promise<boolean> {
  const salted = pin + deviceId
  const hashed = simpleHash(salted)
  const stored = await AsyncStorage.getItem(PASSKEY_STORAGE_KEY)
  if (stored) return stored === hashed
  const { data } = await supabase
    .from('protection_settings')
    .select('loqit_passkey_hash')
    .eq('device_id', deviceId)
    .maybeSingle()
  return data?.loqit_passkey_hash === hashed
}

export async function hasPasskeySet(deviceId: string): Promise<boolean> {
  const local = await AsyncStorage.getItem(PASSKEY_STORAGE_KEY)
  if (local) return true
  const { data } = await supabase
    .from('protection_settings')
    .select('loqit_passkey_hash')
    .eq('device_id', deviceId)
    .maybeSingle()
  return !!data?.loqit_passkey_hash
}

interface Props {
  deviceId: string
  lockMessage?: string
  onUnlocked: () => void
}

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓']

export function LostDeviceLock({ deviceId, lockMessage, onUnlocked }: Props) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [hint, setHint] = useState('')
  const [wrongCount, setWrongCount] = useState(0)
  const [locked, setLocked] = useState(false)
  const [lockTimer, setLockTimer] = useState(0)
  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    AsyncStorage.getItem(PASSKEY_HINT_KEY).then((h) => {
      if (h) setHint(h)
    })
  }, [])

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => handler.remove()
  }, [])

  useEffect(() => {
    if (locked && lockTimer > 0) {
      const t = setTimeout(() => setLockTimer((prev) => prev - 1), 1000)
      return () => clearTimeout(t)
    }
    if (locked && lockTimer === 0) setLocked(false)
  }, [locked, lockTimer])

  const triggerShake = () => {
    shakeAnim.setValue(0)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const handleKey = async (key: string) => {
    if (locked) return
    if (key === '⌫') {
      setPin((prev) => prev.slice(0, -1))
      return
    }
    if (key === '✓') {
      if (pin.length < 4) return
      const ok = await verifyDevicePasskey(pin, deviceId)
      if (ok) {
        onUnlocked()
      } else {
        setPin('')
        triggerShake()
        const next = wrongCount + 1
        setWrongCount(next)
        if (next >= 5) {
          const wait = 30
          setLocked(true)
          setLockTimer(wait)
        }
      }
      return
    }
    if (pin.length < 8) setPin((prev) => prev + key)
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      <LinearGradient colors={['#0a0a1a', '#0f1f3d', '#0a0a1a']} style={StyleSheet.absoluteFill} />

      <View style={styles.logoRow}>
        <MaterialIcons name="shield" size={36} color="#3D8EFF" />
        <Text style={styles.logoText}>LOQIT</Text>
      </View>

      <View style={styles.lockIcon}>
        <MaterialIcons name="lock" size={64} color="#3D8EFF" />
      </View>

      <Text style={styles.lockedTitle}>Device Locked</Text>
      <Text style={styles.lockedSub}>
        {lockMessage || 'This device has been reported as lost. Only the rightful owner can unlock it.'}
      </Text>

      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].slice(0, Math.max(4, pin.length + 1)).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              shake && styles.dotError,
            ]}
          />
        ))}
      </Animated.View>

      {locked ? (
        <Text style={styles.lockMsg}>Too many attempts. Try again in {lockTimer}s</Text>
      ) : (
        hint ? <Text style={styles.hintText}>Hint: {hint}</Text> : null
      )}

      <View style={styles.pad}>
        {PAD_KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => handleKey(key)}
            style={({ pressed }) => [
              styles.padKey,
              key === '✓' && styles.padKeyConfirm,
              key === '⌫' && styles.padKeyDelete,
              pressed && styles.padKeyPressed,
              locked && styles.padKeyDisabled,
            ]}
          >
            <Text
              style={[
                styles.padKeyText,
                key === '✓' && styles.padKeyConfirmText,
                key === '⌫' && styles.padKeyDeleteText,
              ]}
            >
              {key}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.footer}>LOQIT Anti-Theft Protection Active</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoRow: {
    position: 'absolute',
    top: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#3D8EFF',
    fontSize: 22,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 3,
  },
  lockIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(61,142,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(61,142,255,0.25)',
  },
  lockedTitle: {
    color: '#fff',
    fontSize: 26,
    fontFamily: FontFamily.headingBold,
    marginBottom: 10,
  },
  lockedSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontFamily: FontFamily.bodyRegular,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(61,142,255,0.5)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#3D8EFF',
    borderColor: '#3D8EFF',
  },
  dotError: {
    borderColor: '#ef4444',
    backgroundColor: '#ef4444',
  },
  hintText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontFamily: FontFamily.bodyRegular,
    marginBottom: 20,
  },
  lockMsg: {
    color: '#ef4444',
    fontSize: 13,
    fontFamily: FontFamily.bodyMedium,
    marginBottom: 20,
    textAlign: 'center',
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    gap: 12,
    justifyContent: 'center',
    marginBottom: 32,
  },
  padKey: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  padKeyConfirm: {
    backgroundColor: '#3D8EFF',
    borderColor: '#3D8EFF',
  },
  padKeyDelete: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  padKeyPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.93 }],
  },
  padKeyDisabled: {
    opacity: 0.25,
  },
  padKeyText: {
    color: '#fff',
    fontSize: 22,
    fontFamily: FontFamily.headingSemiBold,
  },
  padKeyConfirmText: {
    color: '#fff',
    fontSize: 20,
  },
  padKeyDeleteText: {
    color: '#ef4444',
    fontSize: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    color: 'rgba(255,255,255,0.22)',
    fontSize: 11,
    fontFamily: FontFamily.bodyRegular,
    letterSpacing: 0.5,
  },
})
