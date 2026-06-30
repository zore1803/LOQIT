import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'

import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Toast } from '../../components/ui/Toast'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../hooks/useTheme'

type NotificationItem = { id: string; title: string; body: string; type: string; reference_id: string | null; is_read: boolean; created_at: string }

function SwipeableNotificationCard({ item, onPress, onDismiss, colors }: any) {
  const swipeableRef = useRef<Swipeable>(null)
  const getVisuals = (type: string) => {
    const lc = type.toLowerCase()
    if (lc.includes('chat')) return { icon: 'chat-bubble' as const, tint: colors.secondary }
    if (lc.includes('case')) return { icon: 'gavel' as const, tint: colors.tertiary }
    if (lc.includes('lost')) return { icon: 'warning' as const, tint: colors.error }
    return { icon: 'shield' as const, tint: colors.primary }
  }
  const visuals = getVisuals(item.type)

  const renderRightActions = (_: any, dragX: any) => {
    const scale = dragX.interpolate({ inputRange: [-100, 0], outputRange: [1, 0.5], extrapolate: 'clamp' })
    return (
      <Pressable style={[styles.deleteAction, { backgroundColor: colors.error }]} onPress={() => { swipeableRef.current?.close(); onDismiss(item.id) }}>
        <Animated.View style={[styles.deleteContent, { transform: [{ scale }] }]}><MaterialIcons name="delete-outline" size={22} color="#fff" /><Text style={styles.deleteText}>Dismiss</Text></Animated.View>
      </Pressable>
    )
  }

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} onSwipeableOpen={() => setTimeout(() => onDismiss(item.id), 200)} rightThreshold={100} friction={2} overshootRight={false}>
      <Pressable style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }, !item.is_read && { backgroundColor: colors.surfaceContainerHigh }]} onPress={onPress}>
        {!item.is_read && <View style={[styles.unreadBar, { backgroundColor: visuals.tint }]} />}
        <View style={[styles.iconWrap, { backgroundColor: `${visuals.tint}1A` }]}><MaterialIcons name={visuals.icon} size={18} color={visuals.tint} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.onSurface }, !item.is_read && { fontFamily: FontFamily.headingSemiBold }]} numberOfLines={1}>{item.title}</Text><Text style={[styles.cardBody, { color: colors.outline }]} numberOfLines={2}>{item.body}</Text></View>
        <Text style={[styles.timeText, { color: colors.outline }]}>{Math.max(1, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000))}m</Text>
      </Pressable>
    </Swipeable>
  )
}

export default function AlertsScreen() {
  const router = useRouter(); const { user } = useAuth(); const { colors } = useTheme()
  const [notifications, setNotifications] = useState<NotificationItem[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [toast, setToast] = useState('')

  const fetch = useCallback(async () => {
    if (!user?.id) return; setLoading(true); setError(null)
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (!data) { setError('Fetch failed'); setLoading(false); return }
    setNotifications(data as any); setLoading(false)
  }, [user])

  useEffect(() => { void fetch() }, [fetch])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Alerts</Text>
            {unreadCount > 0 && <Text style={[styles.unreadSub, { color: colors.outline }]}>{unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</Text>}
          </View>
          <Pressable style={[styles.markAllBtn, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }, !unreadCount && { opacity: 0.5 }]} onPress={async () => { await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id || ''); setNotifications(n => n.map(i => ({...i, is_read: true}))); setToast('All read') }} disabled={!unreadCount}>
            <MaterialIcons name="done-all" size={16} color={unreadCount ? colors.primary : colors.outline} />
            <Text style={{ color: unreadCount ? colors.primary : colors.outline, fontFamily: FontFamily.bodyMedium, fontSize: 12 }}>Mark all read</Text>
          </Pressable>
        </View>

        <Toast visible={!!toast} message={toast} type="info" onHide={() => setToast('')} />

        <Animated.ScrollView contentContainerStyle={styles.content}>
          {loading && <View style={{ gap: 10 }}><Skeleton height={72} borderRadius={16} /><Skeleton height={72} borderRadius={16} /></View>}
          {!loading && !notifications.length && (
            <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
              <LinearGradient colors={[colors.primary, colors.accent]} style={styles.emptyIconWrap}><MaterialIcons name="shield" size={28} color="#fff" /></LinearGradient>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>All clear!</Text>
              <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>No alerts. Your devices are safe.</Text>
            </View>
          )}
          {notifications.map(item => (
            <View key={item.id} style={{ overflow: 'hidden', borderRadius: 16 }}>
              <SwipeableNotificationCard item={item} colors={colors} onDismiss={(id: string) => setNotifications(n => n.filter(i => i.id !== id))} onPress={() => router.push({ pathname: '/tracker/[deviceId]', params: { deviceId: item.reference_id || '' } })} />
            </View>
          ))}
        </Animated.ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontFamily: FontFamily.headingBold, fontSize: 24 },
  unreadSub: { fontFamily: FontFamily.bodyRegular, fontSize: 12, marginTop: 2 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120, gap: 8 },
  emptyCard: { marginTop: 32, borderRadius: 20, borderWidth: 1, alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 10 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 18 },
  emptySub: { fontFamily: FontFamily.bodyRegular, fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  cardBody: { marginTop: 2, fontFamily: FontFamily.bodyRegular, fontSize: 12, lineHeight: 17 },
  timeText: { fontFamily: FontFamily.monoMedium, fontSize: 10 },
  deleteAction: { justifyContent: 'center', alignItems: 'flex-end', width: 100, borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  deleteContent: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  deleteText: { color: '#fff', fontFamily: FontFamily.bodyMedium, fontSize: 11, marginTop: 2 }
})
