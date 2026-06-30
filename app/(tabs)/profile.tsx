import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AadhaarVerifyModal } from '../../components/loqit/AadhaarVerifyModal'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { useDevices } from '../../hooks/useDevices'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../hooks/useTheme'

function daysSince(dateIso?: string) {
  if (!dateIso) return 0
  const ms = Date.now() - new Date(dateIso).getTime()
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function MenuItem({ icon, label, onPress, tint, showArrow = true, colors }: any) {
  const iconColor = tint || colors.onSurfaceVariant
  const labelColor = tint || colors.onSurface
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, { borderBottomColor: colors.outlineVariant }, pressed && { backgroundColor: colors.surfaceContainerHigh }]} onPress={onPress} disabled={!onPress}>
      <View style={[styles.menuIcon, { backgroundColor: `${iconColor}1A` }]}><MaterialIcons name={icon} size={18} color={iconColor} /></View>
      <Text style={[styles.menuLabel, { color: labelColor }]}>{label}</Text>
      {showArrow && <MaterialIcons name="chevron-right" size={18} color={colors.outline} />}
    </Pressable>
  )
}

export default function ProfileScreen() {
  const router = useRouter(); const { profile, signOut, user, loading } = useAuth(); const { colors } = useTheme(); const { devices } = useDevices()
  const [reportsCount, setReportsCount] = useState(0); const [loadingReports, setLoadingReports] = useState(false); const [aadhaarModalVisible, setAadhaarModalVisible] = useState(false); const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return; setLoadingReports(true)
      const { count } = await supabase.from('lost_reports').select('id', { count: 'exact', head: true }).eq('owner_id', user.id)
      setReportsCount(count || 0); setLoadingReports(false)
    }
    load()
  }, [user])

  const initials = useMemo(() => {
    const s = profile?.full_name || user?.email || 'LQ'
    return s.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
  }, [profile, user])

  const stats = [
    { label: 'Devices', value: devices.length, color: colors.primary, loading },
    { label: 'Reports', value: reportsCount, color: colors.tertiary, loading: loadingReports },
    { label: 'Days Active', value: daysSince(profile?.created_at), color: colors.secondary, loading: false }
  ]

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
      router.replace('/(auth)/onboarding')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceContainerLow, borderBottomColor: colors.outlineVariant }]}>
          <LinearGradient colors={[colors.primary, colors.accent]} style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></LinearGradient>
          <Text style={[styles.name, { color: colors.onSurface }]}>{profile?.full_name || 'LOQIT User'}</Text>
          <Text style={[styles.email, { color: colors.outline }]}>{user?.email || 'No email linked'}</Text>
          <Pressable style={[styles.verifyBadge, { backgroundColor: profile?.aadhaar_verified ? `${colors.secondary}1A` : `${colors.tertiary}1A` }]} onPress={() => !profile?.aadhaar_verified && setAadhaarModalVisible(true)}>
            <MaterialIcons name={profile?.aadhaar_verified ? 'verified' : 'shield'} size={14} color={profile?.aadhaar_verified ? colors.secondary : colors.tertiary} />
            <Text style={{ color: profile?.aadhaar_verified ? colors.secondary : colors.tertiary, fontFamily: FontFamily.bodyMedium, fontSize: 11 }}>{profile?.aadhaar_verified ? 'Identity Verified' : 'Verify Identity'}</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          {stats.map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
              {s.loading ? <ActivityIndicator color={s.color} size="small" /> : <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>}
              <Text style={[styles.statLabel, { color: colors.outline }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.outline }]}>ACCOUNT</Text>
        <View style={[styles.menuGroup, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
          <MenuItem icon="person" label="Edit Profile" colors={colors} />
          <MenuItem icon="verified-user" label="Verify Aadhaar" onPress={() => setAadhaarModalVisible(true)} colors={colors} />
          <MenuItem icon="settings" label="Settings" onPress={() => router.push('/settings')} colors={colors} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.outline }]}>RECOVERY</Text>
        <View style={[styles.menuGroup, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
          <MenuItem icon="bluetooth-searching" label="Device Scanner" onPress={() => router.push('/(tabs)/scanner')} colors={colors} />
          <MenuItem icon="notifications" label="Alerts" onPress={() => router.push('/(tabs)/alerts')} colors={colors} />
        </View>

        <View style={[styles.disclaimer, { backgroundColor: `${colors.tertiary}0D`, borderColor: `${colors.tertiary}33` }]}>
          <MaterialIcons name="info-outline" size={16} color={colors.tertiary} />
          <Text style={[styles.disclaimerText, { color: colors.outline }]}>LOQIT is a tracking aid and dose not guarantee recovery. Always contact local police.</Text>
        </View>

        <View style={[styles.menuGroup, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
            <LinearGradient colors={[colors.error, '#c44444']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.signOutGradient}><MaterialIcons name="logout" size={20} color="#fff" /><Text style={styles.signOutText}>{signingOut ? 'Signing Out...' : 'Sign Out'}</Text></LinearGradient>
          </Pressable>
          <MenuItem icon="delete-forever" label="Delete Account" tint={colors.error} colors={colors} showArrow={false} />
        </View>
      </ScrollView>

      <AadhaarVerifyModal visible={aadhaarModalVisible} onClose={() => setAadhaarModalVisible(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heroCard: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, alignItems: 'center', gap: 8, borderBottomWidth: 1 },
  avatar: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: '#fff', fontFamily: FontFamily.headingBold, fontSize: 24 },
  name: { fontFamily: FontFamily.headingBold, fontSize: 22 },
  email: { fontFamily: FontFamily.bodyRegular, fontSize: 13 },
  verifyBadge: { marginTop: 4, height: 30, borderRadius: 15, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsRow: { paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 4, borderWidth: 1 },
  statValue: { fontFamily: FontFamily.headingBold, fontSize: 22 },
  statLabel: { fontFamily: FontFamily.bodyRegular, fontSize: 10 },
  sectionLabel: { marginTop: 4, marginLeft: 20, fontFamily: FontFamily.bodyMedium, fontSize: 11, letterSpacing: 1.2 },
  menuGroup: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  menuItem: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  menuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  disclaimer: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, padding: 14, borderWidth: 1 },
  disclaimerText: { flex: 1, fontFamily: FontFamily.bodyRegular, fontSize: 11, lineHeight: 16 },
  signOutBtn: { overflow: 'hidden' },
  signOutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
  signOutText: { color: '#fff', fontFamily: FontFamily.headingSemiBold, fontSize: 15 }
})
