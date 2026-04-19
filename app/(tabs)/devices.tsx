import { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import { GradientButton } from '../../components/ui/GradientButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Toast } from '../../components/ui/Toast'
import { DeviceCard } from '../../components/loqit/DeviceCard'
import { FontFamily } from '../../constants/typography'
import { useDevices } from '../../hooks/useDevices'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'

export default function DevicesScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { devices, loading, error, refetch } = useDevices()

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const initials = useMemo(() => {
    const name = profile?.full_name?.trim() || 'LQ'
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
  }, [profile])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <LinearGradient colors={[colors.primary, colors.accent]} style={styles.brandIcon}><MaterialIcons name="shield" size={16} color="#fff" /></LinearGradient>
          <Text style={[styles.brandText, { color: colors.primary }]}>LOQIT</Text>
        </View>
        <Pressable style={[styles.avatarBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={() => router.push('/(tabs)/profile')}><Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text></Pressable>
      </View>

      {/* Title bar */}
      <View style={styles.titleBar}>
        <View>
          <Text style={[styles.title, { color: colors.onSurface }]}>My Devices</Text>
          <Text style={[styles.titleSub, { color: colors.outline }]}>{devices.length} registered · {devices.filter(d => ['registered', 'recovered'].includes(d.status)).length} safe</Text>
        </View>
        <View style={{ minWidth: 130 }}><GradientButton title="+ Register" onPress={() => router.push('/device/add')} /></View>
      </View>

      {loading && (
        <View style={styles.skeletons}>
          <Skeleton height={80} borderRadius={16} />
          <Skeleton height={80} borderRadius={16} />
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl tintColor={colors.primary} refreshing={loading} onRefresh={() => void refetch()} />}
        renderItem={({ item }) => (
          <DeviceCard id={item.id} make={item.make} model={item.model} serial={item.serial_number} status={item.status} width="100%" onPress={id => router.push({ pathname: '/device/[id]', params: { id } })} />
        )}
        ListEmptyComponent={!loading ? (
          <Pressable style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]} onPress={() => router.push('/device/add')}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceContainerHigh }]}><MaterialIcons name="phone-android" size={36} color={colors.outline} /></View>
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No devices registered</Text>
            <Text style={[styles.emptySub, { color: colors.outline }]}>Add your first device to start protection</Text>
            <View style={[styles.emptyAction, { backgroundColor: `${colors.primary}1A` }]}><MaterialIcons name="add" size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontFamily: FontFamily.bodyMedium }}>Register Device</Text></View>
          </Pressable>
        ) : null}
      />
      {!loading && error && <ErrorState message={error} onRetry={() => void refetch()} />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { height: 60, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: FontFamily.headingBold, fontSize: 16, letterSpacing: 1 },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  titleBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: FontFamily.headingBold, fontSize: 24 },
  titleSub: { fontFamily: FontFamily.bodyRegular, fontSize: 12, marginTop: 2 },
  skeletons: { paddingHorizontal: 20, gap: 10, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4, gap: 10 },
  emptyCard: { marginTop: 24, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 32, alignItems: 'center', gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 16 },
  emptySub: { fontFamily: FontFamily.bodyRegular, fontSize: 13, textAlign: 'center' },
  emptyAction: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }
})