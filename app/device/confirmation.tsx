import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GradientButton } from '../../components/ui/GradientButton'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { bleService } from '../../services/ble.service'

type DeviceKeyRow = {
  loqit_key: string | null
  ble_device_uuid: string | null
}

export default function DeviceConfirmationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ deviceId?: string }>()
  const deviceId = typeof params.deviceId === 'string' ? params.deviceId : ''

  const [loqitKey, setLoqitKey] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeBroadcastUuidRef = useRef<string | null>(null)

  useEffect(() => {
    if (!deviceId) {
      setLoadingKey(false)
      setError('Missing device reference.')
      return
    }

    let active = true
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const applyRow = async (row: DeviceKeyRow | null) => {
      if (!active || !row) {
        return
      }

      if (row.loqit_key) {
        setLoqitKey(row.loqit_key)
        setLoadingKey(false)
      }

      if (row.ble_device_uuid) {
        if (activeBroadcastUuidRef.current !== row.ble_device_uuid) {
          activeBroadcastUuidRef.current = row.ble_device_uuid

          void bleService.startBroadcasting(row.ble_device_uuid).catch((broadcastError) => {
            const message =
              broadcastError instanceof Error
                ? broadcastError.message
                : 'Unable to start always-on BLE broadcasting.'
            if (active) {
              setError((current) => current ?? `Device registered, but background beacon start failed: ${message}`)
            }
            activeBroadcastUuidRef.current = null
          })
        }
      }
    }

    const loadLatest = async () => {
      const { data, error: loadError } = await db
        .from('devices')
        .select('loqit_key, ble_device_uuid')
        .eq('id', deviceId)
        .maybeSingle()

      if (!active) {
        return
      }

      if (loadError) {
        setError(loadError.message)
        setLoadingKey(false)
        return
      }

      await applyRow((data as DeviceKeyRow | null) ?? null)
      if (!data?.loqit_key) {
        setLoadingKey(true)
      }
    }

    void loadLatest()

    // Realtime may be unavailable; poll as fallback so screen never hangs indefinitely.
    pollTimer = setInterval(() => {
      if (!active || loqitKey) {
        return
      }

      void loadLatest()
    }, 2000)

    const channel = db
      .channel(`device-key-${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `id=eq.${deviceId}`,
        },
        (payload) => {
          const next = payload.new as DeviceKeyRow
          void applyRow(next)
        }
      )
      .subscribe()

    return () => {
      active = false
      if (pollTimer) {
        clearInterval(pollTimer)
      }
      void db.removeChannel(channel)
    }
  }, [deviceId, loqitKey])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/devices')}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Registration Complete</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.successWrap}>
          <View style={styles.successIconWrap}>
            <MaterialIcons name="check" size={24} color={Colors.secondary} />
          </View>
          <Text style={styles.title}>Device Added Successfully</Text>
          <Text style={styles.subtitle}>Your secure LOQIT key will appear shortly.</Text>
        </View>

        <View style={styles.keyCard}>
          <Text style={styles.keyLabel}>LOQIT Key</Text>

          {loqitKey ? (
            <Text style={styles.keyValue}>{loqitKey}</Text>
          ) : (
            <View style={styles.loadingKeyWrap}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingKeyText}>Generating secure key...</Text>
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <GradientButton title="Go to My Devices" onPress={() => router.replace('/(tabs)/devices')} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    height: 64,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 20,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 18,
  },
  successWrap: {
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  successIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: `${Colors.secondary}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 22,
  },
  subtitle: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
  },
  keyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  keyLabel: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  keyValue: {
    color: Colors.onSurface,
    fontFamily: FontFamily.monoMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  loadingKeyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingKeyText: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
})
