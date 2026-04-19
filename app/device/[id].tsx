import { useEffect, useMemo, useRef, useState } from 'react'
import * as Location from 'expo-location'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GradientButton } from '../../components/ui/GradientButton'
import { FontFamily } from '../../constants/typography'
import { markFound, reportLost, useDevice } from '../../hooks/useDevices'
import { supabase } from '../../lib/supabase'
import { bleService } from '../../services/ble.service'
import { useTheme } from '../../hooks/useTheme'

const LOCATIONIQ_API_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY || 'pk.b5ada85774117c8a8d65dd878a514073'

function StaticMapView({ latitude, longitude, zoom = 14, isDark }: { latitude: number; longitude: number; zoom?: number; isDark: boolean }) {
  if (!LOCATIONIQ_API_KEY) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1a1d24' : '#e0e0e0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: isDark ? '#9ca3af' : '#616161', fontSize: 12 }}>Map Key Missing</Text>
      </View>
    )
  }
  const src = `https://maps.locationiq.com/v3/staticmap?key=${LOCATIONIQ_API_KEY}&center=${latitude},${longitude}&zoom=${zoom}&size=800x400&format=png&maptype=streets`
  return (
    <View style={StyleSheet.absoluteFill}>
       <Image source={{ uri: src }} style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#1a1d24' : '#f5f5f5' }]} resizeMode="cover" />
       <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(18, 20, 26, 0.4)' : 'rgba(255, 255, 255, 0.1)' }]} />
       <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
         <MaterialIcons name="place" size={32} color="#e53935" />
       </View>
    </View>
  )
}

function formatRelativeFrom(dateString?: string | null) {
  if (!dateString) return 'Unknown'
  const diffMs = Date.now() - new Date(dateString).getTime()
  const min = Math.max(1, Math.floor(diffMs / 60000))
  if (min < 60) return `${min} minutes ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} hours ago`
  return `${Math.floor(hrs / 24)} days ago`
}

export default function DeviceDetailScreen() {
  const router = useRouter(); const { id } = useLocalSearchParams<{ id: string }>()
  const { device, loading, refetch } = useDevice(id)
  const { colors, isDark } = useTheme()
  const pulse = useRef(new Animated.Value(0)).current
  const [submitting, setSubmitting] = useState(false)
  const [lostModal, setLostModal] = useState(false)
  const [lostForm, setLostForm] = useState({ incident_description: '', last_known_address: '', police_complaint_number: '', reward_amount: '' })

  useEffect(() => {
    if (device?.status !== 'lost') return
    const anim = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true })]))
    anim.start(); return () => anim.stop()
  }, [device?.status, pulse])

  const reportLostNow = async () => {
    if (!device?.id) return
    if (!lostForm.incident_description.trim() || !lostForm.last_known_address.trim()) {
      Alert.alert('Validation', 'Incident description and last known address are required.')
      return
    }
    setSubmitting(true)
    try {
      // 1. Capture current location for the report
      let currentLat = device.last_seen_lat;
      let currentLng = device.last_seen_lng;
      
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          currentLat = loc.coords.latitude;
          currentLng = loc.coords.longitude;
        }
      } catch (locErr) {
        console.warn('[DeviceDetail] Could not get fresh location for report:', locErr);
      }

      await reportLost(device.id, { 
        ...lostForm, 
        reward_amount: lostForm.reward_amount ? Number(lostForm.reward_amount) : null, 
        last_known_lat: currentLat, 
        last_known_lng: currentLng 
      })
      setLostModal(false); await refetch(); Alert.alert('Success', 'Device marked as lost.')
    } catch (e: any) { Alert.alert('Error', e.message) } finally { setSubmitting(false) }
  }

  if (loading) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} style={styles.loading} /></SafeAreaView>
  if (!device) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={styles.errorWrap}><Text style={{ color: colors.error }}>Device not found.</Text></View></SafeAreaView>

  const isLost = device.status === 'lost'; const safeStatus = ['registered', 'recovered'].includes(device.status)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable style={[styles.backButton, { backgroundColor: colors.surfaceContainerLow }]} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{`${device.make} ${device.model}`}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceContainerHigh }]}>
          <View style={[styles.heroIconCircle, { backgroundColor: colors.surfaceVariant }]}><MaterialIcons name="smartphone" size={40} color={colors.primary} /></View>
          <Text style={[styles.heroTitle, { color: colors.onSurface }]}>{`${device.make} ${device.model}`}</Text>
          <View style={styles.statusRow}>
            {isLost && <Animated.View style={[styles.pulseDot, { backgroundColor: colors.error, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.3] }) }] }]} />}
            <View style={[styles.statusBadge, { backgroundColor: safeStatus ? `${colors.secondary}22` : `${colors.error}22` }]}>
              <Text style={{ color: safeStatus ? colors.secondary : colors.error, fontFamily: FontFamily.bodyMedium, fontSize: 12 }}>{device.status.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={[styles.imeiLabel, { color: colors.onSurfaceVariant }]}>BLE DEVICE UUID</Text>
          <Text style={[styles.imeiValue, { color: colors.onSurfaceVariant }]}>{device.ble_device_uuid || 'GENERIC'}</Text>
        </View>

        <View style={styles.infoGrid}>
          {[ {l: 'Serial Number', v: device.serial_number, m: true}, {l: 'Color', v: device.color || 'Unknown'}, {l: 'Purchase Date', v: device.purchase_date || 'N/A'}, {l: 'Registered', v: new Date(device.created_at).toISOString().slice(0, 10)} ].map(i => (
            <View key={i.l} style={[styles.infoCell, { backgroundColor: colors.surfaceContainerLow }]}>
              <Text style={[styles.infoLabel, { color: colors.onSurfaceVariant }]}>{i.l}</Text>
              <Text style={[i.m ? styles.infoMono : styles.infoValue, { color: colors.onSurface }]}>{i.v}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.lastSeenCard, { backgroundColor: colors.surfaceContainerHigh }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Location Status</Text>
          <Text style={[styles.lastSeenText, { color: colors.onSurfaceVariant }]}>{`Last seen ${formatRelativeFrom(device.last_seen_at)}`}</Text>
          <View style={[styles.mapPlaceholder, { overflow: 'hidden', backgroundColor: colors.surfaceContainerLow }]}>
            <StaticMapView latitude={device.last_seen_lat || 18.9388} longitude={device.last_seen_lng || 72.8354} isDark={isDark} />
          </View>
        </View>

        <View style={styles.actionsWrap}>
          {safeStatus && <GradientButton title="Report as Lost" onPress={() => setLostModal(true)} />}
          {isLost && (
            <>
              <Pressable style={[styles.ghostButton, { borderColor: colors.outlineVariant }]} onPress={() => markFound(device.id).then(() => refetch())}><Text style={[styles.ghostButtonText, { color: colors.onSurface }]}>Mark as Found</Text></Pressable>
              <GradientButton title="View Live Tracker" onPress={() => router.push({ pathname: '/tracker/[deviceId]', params: { deviceId: device.id } })} />
            </>
          )}
          <Pressable style={[styles.ghostButton, { borderColor: colors.outlineVariant }]} onPress={() => Alert.alert('Info', 'Phased release feature.')}><Text style={[styles.ghostButtonText, { color: colors.onSurface }]}>Share for Resale</Text></Pressable>
        </View>
      </ScrollView>

      <Modal visible={lostModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainer }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Report Device as Lost</Text>
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, color: colors.onSurface }]} value={lostForm.incident_description} onChangeText={t => setLostForm(f => ({...f, incident_description: t}))} placeholder="Incident description" placeholderTextColor={colors.outline} multiline />
            <TextInput style={[styles.input, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, color: colors.onSurface }]} value={lostForm.last_known_address} onChangeText={t => setLostForm(f => ({...f, last_known_address: t}))} placeholder="Last known address" placeholderTextColor={colors.outline} />
            <GradientButton title="Submit Report" onPress={reportLostNow} loading={submitting} />
            <Pressable onPress={() => setLostModal(false)}><Text style={[styles.cancelText, { color: colors.onSurfaceVariant }]}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { marginTop: 120 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  backButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 18 },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },
  heroCard: { borderRadius: 24, padding: 24, alignItems: 'center', gap: 10 },
  heroIconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: FontFamily.headingBold, fontSize: 22, textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  imeiLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11, letterSpacing: 1 },
  imeiValue: { fontFamily: FontFamily.monoMedium, fontSize: 13 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  infoCell: { width: '48%', borderRadius: 12, padding: 12, minHeight: 84, justifyContent: 'center', gap: 5 },
  infoLabel: { fontFamily: FontFamily.bodyRegular, fontSize: 11 },
  infoValue: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  infoMono: { fontFamily: FontFamily.monoMedium, fontSize: 12 },
  lastSeenCard: { borderRadius: 16, padding: 14, gap: 8 },
  sectionTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 16 },
  lastSeenText: { fontFamily: FontFamily.bodyRegular, fontSize: 13 },
  mapPlaceholder: { marginTop: 6, borderRadius: 12, minHeight: 88, alignItems: 'center', justifyContent: 'center' },
  actionsWrap: { gap: 10 },
  ghostButton: { borderRadius: 16, borderWidth: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22, gap: 10 },
  sheetHandle: { width: 50, height: 5, borderRadius: 4, alignSelf: 'center' },
  modalTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 20, marginBottom: 2 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontFamily: FontFamily.bodyRegular, fontSize: 14 },
  textArea: { minHeight: 88, maxHeight: 130, paddingTop: 10 },
  cancelText: { textAlign: 'center', fontFamily: FontFamily.bodyMedium, fontSize: 14, marginTop: 4 }
})
