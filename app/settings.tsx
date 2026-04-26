import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Header } from '../components/ui/Header'
import { Toast } from '../components/ui/Toast'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'
import {
  disableBackgroundBleScanTask,
  enableBackgroundBleScanTask,
} from '../services/backgroundBleTask'
import { useTheme } from '../hooks/useTheme'

const BLE_KEY = '@loqit/ble_scan_enabled'
const SHARE_LOCATION_KEY = '@loqit/location_share_enabled'
const ANON_CHAT_KEY = '@loqit/anonymous_chat_enabled'

function SettingToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
  colors,
}: {
  title: string
  subtitle: string
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  colors: any
}) {
  return (
    <View style={[styles.settingRow, { backgroundColor: colors.surfaceContainerHigh }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingTitle, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[styles.settingSub, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
      </View>

      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.outlineVariant, true: `${colors.primary}70` }}
        thumbColor={value ? colors.primary : colors.outline}
      />
    </View>
  )
}

function ThemeOption({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.themeOption,
        { backgroundColor: active ? colors.primaryContainer : colors.surfaceContainerLow },
        active && { borderColor: colors.primary, borderWidth: 1 }
      ]}
    >
      <MaterialIcons
        name={label === 'light' ? 'light-mode' : label === 'dark' ? 'dark-mode' : 'settings-brightness'}
        size={20}
        color={active ? colors.onPrimaryContainer : colors.onSurfaceVariant}
      />
      <Text style={[styles.themeOptionLabel, { color: active ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
    </Pressable>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { theme, setTheme, colors } = useTheme()

  const [bleEnabled, setBleEnabled] = useState(false)
  const [locationEnabled, setLocationEnabled] = useState(true)
  const [anonymousChatEnabled, setAnonymousChatEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    const load = async () => {
      const [ble, location, anonymous] = await Promise.all([
        AsyncStorage.getItem(BLE_KEY),
        AsyncStorage.getItem(SHARE_LOCATION_KEY),
        AsyncStorage.getItem(ANON_CHAT_KEY),
      ])

      const blePref = ble === 'true'
      setBleEnabled(blePref)
      setLocationEnabled(location !== 'false')
      setAnonymousChatEnabled(anonymous !== 'false')

      if (blePref) {
        await enableBackgroundBleScanTask()
      }
    }

    void load()
  }, [])

  const toggleBleBackground = async (next: boolean) => {
    setSaving(true)
    try {
      if (next) {
        const enabled = await enableBackgroundBleScanTask()
        if (!enabled) {
          throw new Error('Background scan is restricted on this device.')
        }
      } else {
        await disableBackgroundBleScanTask()
      }

      await AsyncStorage.setItem(BLE_KEY, String(next))
      setBleEnabled(next)
      setToast({
        message: next ? 'Background BLE scan enabled' : 'Background BLE scan disabled',
        type: 'success',
      })
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Unable to update BLE background setting.',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleSimplePreference = async (
    key: string,
    value: boolean,
    setter: (next: boolean) => void,
    label: string
  ) => {
    setter(value)
    await AsyncStorage.setItem(key, String(value))
    setToast({ message: `${label} ${value ? 'enabled' : 'disabled'}`, type: 'info' })
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Settings" onBackPress={() => router.back()} rightIcon="settings" />

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Appearance</Text>
        <View style={styles.themeRow}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <ThemeOption
              key={t}
              label={t}
              active={theme === t}
              onPress={() => setTheme(t)}
              colors={colors}
            />
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 16 }]}>Background Activity</Text>
        <View style={[styles.infoCard, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}1A` }]}>
          <MaterialIcons name="info-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.onSurfaceVariant }]}>
            Background BLE scan runs approximately every 5 minutes. Actual cadence depends on OS battery policy.
          </Text>
        </View>

        <View style={styles.settingsGrid}>
          <SettingToggleRow
            title="BLE Background Scanning"
            subtitle="Continue periodic BLE scans and lost-device location updates in the background."
            value={bleEnabled}
            disabled={saving}
            colors={colors}
            onChange={(next) => {
              void toggleBleBackground(next)
            }}
          />

          <SettingToggleRow
            title="Location Sharing"
            subtitle="Allow secure location updates when helping with device recovery."
            value={locationEnabled}
            colors={colors}
            onChange={(next) => {
              void toggleSimplePreference(SHARE_LOCATION_KEY, next, setLocationEnabled, 'Location sharing')
            }}
          />

          <SettingToggleRow
            title="Anonymous Chat"
            subtitle="Enable private finder-owner messaging without exposing identity details."
            value={anonymousChatEnabled}
            colors={colors}
            onChange={(next) => {
              void toggleSimplePreference(ANON_CHAT_KEY, next, setAnonymousChatEnabled, 'Anonymous chat')
            }}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 16 }]}>Legal & Privacy</Text>
        <View style={styles.settingsGrid}>
          <Pressable
            style={[styles.settingRow, { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={() => router.push('/privacy-policy')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.onSurface }]}>Privacy Policy</Text>
              <Text style={[styles.settingSub, { color: colors.onSurfaceVariant }]}>How we manage and protect your identification data.</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </Pressable>

          <Pressable
            style={[styles.settingRow, { backgroundColor: colors.surfaceContainerHigh }]}
            onPress={() => Alert.alert('Terms of Service', 'Standard LOQIT Service Agreement.')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.onSurface }]}>Terms of Service</Text>
              <Text style={[styles.settingSub, { color: colors.onSurfaceVariant }]}>Rules and guidelines for using the LOQIT network.</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
        </View>

        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ color: colors.outline, fontSize: 11, fontFamily: FontFamily.bodyRegular }}>
            LOQIT v1.0.0 (Secure Build)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    marginBottom: 12,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  themeOption: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  themeOptionLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  settingsGrid: {
    gap: 10,
    marginBottom: 20,
  },
  settingRow: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
  },
  settingSub: {
    marginTop: 4,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  legalRow: {
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legalTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
})
