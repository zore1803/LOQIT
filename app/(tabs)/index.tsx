import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import { AadhaarVerifyModal } from '../../components/loqit/AadhaarVerifyModal'
import { DeviceCard } from '../../components/loqit/DeviceCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { useDevices } from '../../hooks/useDevices'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import { bleService } from '../../services/ble.service'
import { useTheme } from '../../hooks/useTheme'

type NotificationItem = {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  created_at: string
}

function getGreetingPrefix() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getRelativeTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function HomeScreen() {
  const router = useRouter()
  const { profile, user, signOut } = useAuth()
  const { colors } = useTheme()
  const { devices, loading: loadingDevices, error: devicesError, refetch } = useDevices()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [aadhaarModalVisible, setAadhaarModalVisible] = useState(false)
  const [showReportPicker, setShowReportPicker] = useState(false)
  const [displayCounts, setDisplayCounts] = useState({ total: 0, alerts: 0, safe: 0 })

  const quickActions = useMemo(() => [
    { key: 'lost', icon: 'report-problem' as const, label: 'Report Lost', tint: colors.error },
    { key: 'lockdown', icon: 'lock-person' as const, label: 'Hard Lockdown', tint: colors.primary, route: '/security/setup' },
    { key: 'scan', icon: 'bluetooth-searching' as const, label: 'Scan Nearby', tint: colors.inversePrimary, route: '/(tabs)/scanner' },
    { key: 'verify', icon: 'verified-user' as const, label: 'Verify Phone', tint: colors.secondary, route: '/verify' },
  ], [colors])

  const getNotificationIcon = (type: string): keyof typeof MaterialIcons.glyphMap => {
    if (type.includes('lost')) return 'warning'
    if (type.includes('found')) return 'check-circle'
    return 'shield'
  }

  const getNotificationColor = (type: string) => {
    if (type.includes('lost')) return colors.error
    if (type.includes('found')) return colors.secondary
    return colors.inversePrimary
  }

  useEffect(() => {
    // Passive scan is natively handled by _layout.tsx and backgroundBleTask.
    return () => {
      // Cleanup if any existing component-level scan was manually started here later
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) { setNotifications([]); return }
    setLoadingNotifications(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setNotifications((data as NotificationItem[]) ?? [])
    setLoadingNotifications(false)
  }, [user?.id])

  useEffect(() => { void fetchNotifications() }, [fetchNotifications])

  const totals = useMemo(() => ({
    total: devices.length,
    safe: devices.filter(d => ['registered', 'recovered'].includes(d.status)).length,
    alerts: notifications.filter(n => !n.is_read).length
  }), [devices, notifications])

  useEffect(() => {
    const duration = 500; const steps = 20; let current = 0
    const timer = setInterval(() => {
      current++
      const p = current / steps
      setDisplayCounts({ total: Math.round(totals.total * p), alerts: Math.round(totals.alerts * p), safe: Math.round(totals.safe * p) })
      if (current >= steps) clearInterval(timer)
    }, duration / steps)
    return () => clearInterval(timer)
  }, [totals])

  const initials = useMemo(() => {
    const name = profile?.full_name || user?.email || 'LQ'
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
  }, [profile, user])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/(auth)/onboarding')
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <LinearGradient colors={[colors.primary, colors.accent]} style={styles.brandIcon}><MaterialIcons name="shield" size={16} color="#fff" /></LinearGradient>
          <Text style={[styles.brandText, { color: colors.primary }]}>LOQIT</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={[styles.headerBtn, { backgroundColor: colors.surfaceContainerLow }]} onPress={handleSignOut}><MaterialIcons name="logout" size={20} color={colors.onSurfaceVariant} /></Pressable>
          <Pressable style={[styles.headerBtn, { backgroundColor: colors.surfaceContainerLow }]} onPress={() => router.push('/(tabs)/alerts')}>
            <MaterialIcons name="notifications-none" size={20} color={colors.onSurfaceVariant} />
            {totals.alerts > 0 && <View style={[styles.badge, { backgroundColor: colors.error }]} />}
          </Pressable>
          <Pressable style={[styles.avatarBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={() => router.push('/(tabs)/profile')}><Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text></Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingWrap}>
          <Text style={[styles.greeting, { color: colors.onSurfaceVariant }]}>{getGreetingPrefix()},</Text>
          <Text style={[styles.greetingName, { color: colors.onSurface }]}>{profile?.full_name || 'User'}</Text>
          <Text style={[styles.greetingSub, { color: colors.outline }]}>Your secure network is active and monitoring.</Text>
        </View>

        {!profile?.aadhaar_verified && (
          <Pressable style={[styles.banner, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]} onPress={() => setAadhaarModalVisible(true)}>
            <View style={[styles.bannerIcon, { backgroundColor: `${colors.tertiary}1A` }]}><MaterialIcons name="verified-user" size={18} color={colors.tertiary} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.bannerTitle, { color: colors.onSurface }]}>Complete Identity Verification</Text><Text style={[styles.bannerSub, { color: colors.outline }]}>Verify Aadhaar to unlock all features</Text></View>
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </Pressable>
        )}

        <View style={styles.statsRow}>
          {[ {l: 'Devices', v: displayCounts.total, c: colors.primary}, {l: 'Safe', v: displayCounts.safe, c: colors.secondary}, {l: 'Alerts', v: displayCounts.alerts, c: colors.tertiary} ].map(s => (
            <View key={s.l} style={[styles.statCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
              <Text style={[styles.statValue, { color: s.c }]}>{s.v}</Text>
              <Text style={[styles.statLabel, { color: colors.outline }]}>{s.l}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>My Devices</Text>
          <Pressable style={[styles.addBadge, { backgroundColor: `${colors.primary}1A` }]} onPress={() => router.push('/device/add')}><MaterialIcons name="add" size={14} color={colors.primary} /><Text style={[styles.addText, { color: colors.primary }]}>Add</Text></Pressable>
        </View>

        {loadingDevices ? (
          <View style={{ flexDirection: 'row', gap: 12 }}><Skeleton width={200} height={170} borderRadius={20} /><Skeleton width={200} height={170} borderRadius={20} /></View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {devices.map(d => (
              <DeviceCard key={d.id} {...d} serial={d.serial_number || 'N/A'} onPress={id => router.push({ pathname: '/device/[id]', params: { id } } as any)} />
            ))}
            {!devices.length && (
              <Pressable style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]} onPress={() => router.push('/device/add')}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceContainerHigh }]}><MaterialIcons name="add-circle-outline" size={32} color={colors.outline} /></View>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Register a Device</Text>
                <Text style={[styles.emptySub, { color: colors.outline }]}>Add your first device to start tracking</Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 10 }]}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {quickActions.map(a => (
            <Pressable key={a.key} style={[styles.quickCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]} onPress={() => { if (a.route) router.push(a.route as any); else setShowReportPicker(true); }}>
              <View style={[styles.quickIconBg, { backgroundColor: `${a.tint}1A` }]}><MaterialIcons name={a.icon} size={22} color={a.tint} /></View>
              <Text style={[styles.quickLabel, { color: colors.onSurface }]}>{a.label}</Text>
              <MaterialIcons name="arrow-forward" size={14} color={colors.outline} />
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent Activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/alerts')}><Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text></Pressable>
        </View>

        <View style={{ gap: 8 }}>
          {!notifications.length && (
            <View style={[styles.activityEmpty, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}><MaterialIcons name="notifications-off" size={24} color={colors.outline} /><Text style={[styles.activityEmptyText, { color: colors.outline }]}>No recent activity</Text></View>
          )}
          {notifications.map(n => (
            <View style={[styles.activityCard, { backgroundColor: colors.surfaceContainerLow }]} key={n.id}>
              <View style={[styles.activityIcon, { backgroundColor: `${getNotificationColor(n.type)}1A` }]}><MaterialIcons name={getNotificationIcon(n.type)} color={getNotificationColor(n.type)} size={16} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={1}>{n.title}</Text><Text style={[styles.activityBody, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{n.body}</Text></View>
              <Text style={[styles.activityTime, { color: colors.outline }]}>{getRelativeTime(n.created_at)}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.refreshBtn} onPress={() => { refetch(); fetchNotifications() }}><MaterialIcons name="refresh" size={16} color={colors.primary} /><Text style={[styles.refreshText, { color: colors.primary }]}>Refresh Data</Text></Pressable>
      </ScrollView>

      <Modal visible={showReportPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Select Device to Report</Text>
            <View style={{ gap: 8, marginTop: 16 }}>
              {devices.map(d => (
                <Pressable key={d.id} style={styles.sheetRow} onPress={() => { setShowReportPicker(false); router.push({ pathname: '/device/[id]', params: { id: d.id } } as any) }}>
                  <Text style={[styles.sheetRowTitle, { color: colors.onSurface }]}>{`${d.make} ${d.model}`}</Text>
                  <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.sheetCancel} onPress={() => setShowReportPicker(false)}><Text style={[styles.sheetCancelText, { color: colors.error }]}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      <AadhaarVerifyModal visible={aadhaarModalVisible} onClose={() => setAadhaarModalVisible(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { height: 60, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: FontFamily.headingBold, fontSize: 16, letterSpacing: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, gap: 20 },
  greetingWrap: { gap: 2 },
  greeting: { fontFamily: FontFamily.bodyRegular, fontSize: 14 },
  greetingName: { fontFamily: FontFamily.headingBold, fontSize: 26, marginBottom: 2 },
  greetingSub: { fontFamily: FontFamily.bodyRegular, fontSize: 13 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, borderWidth: 1 },
  bannerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  bannerSub: { fontFamily: FontFamily.bodyRegular, fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 4, borderWidth: 1 },
  statValue: { fontFamily: FontFamily.headingBold, fontSize: 28 },
  statLabel: { fontFamily: FontFamily.bodyRegular, fontSize: 11 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 18 },
  addBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  seeAllText: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  emptyCard: { width: 220, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 24, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  emptySub: { fontFamily: FontFamily.bodyRegular, fontSize: 11, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: { width: '48.5%', borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  quickIconBg: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  activityEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8, borderRadius: 14, borderWidth: 1 },
  activityEmptyText: { fontFamily: FontFamily.bodyRegular, fontSize: 12 },
  activityCard: { borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 14, marginBottom: 2 },
  activityBody: { fontFamily: FontFamily.bodyRegular, fontSize: 12 },
  activityTime: { fontFamily: FontFamily.bodyRegular, fontSize: 11 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  refreshText: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 18, textAlign: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  sheetRowTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 15 },
  sheetCancel: { marginTop: 20, alignItems: 'center', paddingVertical: 12 },
  sheetCancelText: { fontFamily: FontFamily.headingSemiBold, fontSize: 16 }
}
)