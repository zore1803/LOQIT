import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'

import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'

import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { useTheme } from '../../hooks/useTheme'

type Region = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

type BeaconLog = {
  id: string
  latitude: number
  longitude: number
  accuracy_meters: number | null
  rssi: number | null
  reported_at: string
}

type DeviceBrief = {
  id: string
  make: string
  model: string
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#12141a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7c838f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#12141a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3138' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f223d' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1f2a' }] },
]

const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
]

function InteractiveMap({ latitude, longitude, mapRef, pulse, path = [], colors, isDark }: any) {
  if (isNaN(latitude) || isNaN(longitude) || latitude === 0) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>
  }
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
      customMapStyle={isDark ? darkMapStyle : lightMapStyle}
      showsUserLocation={true}
      loadingEnabled={true}
      loadingIndicatorColor={colors.primary}
    >
      {path.length > 1 && <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={3} lineDashPattern={[5, 5]} />}
      {path.map((p: any, i: number) => <Circle key={i} center={p} radius={i === 0 ? 0 : 5} fillColor={i === 0 ? 'transparent' : `${colors.primary}80`} strokeWidth={0} />)}
      
      {/* Pulse Radar for Lost Device */}
      <Circle
        center={{ latitude, longitude }}
        radius={100}
        fillColor={pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [`${colors.primary}10`, `${colors.primary}05`]
        }) as any}
        strokeColor={colors.primary}
        strokeWidth={1}
      />

      <Marker coordinate={{ latitude, longitude }}>
        <View style={styles.markerWrap}>
          <Animated.View style={[styles.markerPulse, { borderColor: `${colors.primary}80`, backgroundColor: `${colors.primary}30`, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.5] }) }] }]} />
          <View style={[styles.markerCore, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.primary, elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 10 }]}>
            <MaterialIcons name="shield" size={18} color={colors.primary} />
          </View>
        </View>
      </Marker>
    </MapView>
  )
}

export default function TrackerScreen() {
  const router = useRouter(); const { user } = useAuth(); const { colors, isDark } = useTheme()
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>()
  const mapRef = useRef<any>(null); const pulse = useRef(new Animated.Value(0)).current
  const [loading, setLoading] = useState(true); const [device, setDevice] = useState<DeviceBrief | null>(null); const [logs, setLogs] = useState<BeaconLog[]>([])

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true })]))
    anim.start(); return () => anim.stop()
  }, [pulse])

  const fetchTrackerData = useCallback(async () => {
    if (!user?.id || !deviceId) return
    setLoading(true)
    const [{ data: d }, { data: l }] = await Promise.all([
      db.from('devices').select('id, make, model, status').eq('id', deviceId).maybeSingle(),
      db.from('beacon_logs').select('*').eq('device_id', deviceId).order('reported_at', { ascending: false }).limit(20)
    ])
    
    const deviceData = d as any
    setDevice(deviceData)
    
    const logData = l as BeaconLog[] || []
    setLogs(logData)
    setLoading(false)
  }, [deviceId, user])

  useEffect(() => { void fetchTrackerData() }, [fetchTrackerData])

  const latestLog = logs[0]
  const pathCoordinates = useMemo(() => [...logs].reverse().map(l => ({ latitude: l.latitude, longitude: l.longitude })), [logs])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <InteractiveMap latitude={latestLog?.latitude || 18.9388} longitude={latestLog?.longitude || 72.8354} mapRef={mapRef} pulse={pulse} path={pathCoordinates} colors={colors} isDark={isDark} />
      
      <View style={styles.topBarWrap}>
        <BlurView intensity={34} tint={isDark ? 'dark' : 'light'} style={styles.topBar}>
          <Pressable style={[styles.topBarBack, { backgroundColor: `${colors.onSurface}10` }]} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={21} color={colors.onSurface} /></Pressable>
          <View style={{ flex: 1 }}><Text style={[styles.topBarTitle, { color: colors.onSurface }]}>{device ? `${device.make} ${device.model}` : 'Live Tracker'}</Text></View>
          <View style={[styles.liveBadge, { backgroundColor: `${colors.secondary}20`, borderColor: `${colors.secondary}40` }]}>
            <Animated.View style={[styles.liveDot, { backgroundColor: colors.secondary, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]} />
            <Text style={[styles.liveText, { color: colors.secondary }]}>LIVE</Text>
          </View>
        </BlurView>
      </View>

      <View style={[styles.bottomSheet, { backgroundColor: colors.surfaceContainerLow }]}>
        {!latestLog ? (
          <View style={styles.emptyStateWrap}>
            <MaterialIcons name="location-off" size={24} color={colors.outline} />
            <Text style={[styles.emptyStateText, { color: colors.onSurfaceVariant }]}>No location data yet. BLE scanning will update this map when your device is detected nearby.</Text>
          </View>
        ) : (
          <>
            <View style={styles.metaRow}>
              {[ {l: 'Last Updated', v: new Date(latestLog.reported_at).toLocaleTimeString()}, {l: 'Source', v: latestLog.rssi ? 'BLE' : 'GPS'}, {l: 'Accuracy', v: `${Math.round(latestLog.accuracy_meters || 0)}m`} ].map(m => (
                <View key={m.l}><Text style={[styles.metaLabel, { color: colors.outline }]}>{m.l}</Text><Text style={[styles.metaValue, { color: colors.onSurface }]}>{m.v}</Text></View>
              ))}
            </View>
            <Text style={[styles.coordinates, { color: colors.primary }]}>{`${latestLog.latitude.toFixed(5)}, ${latestLog.longitude.toFixed(5)}`}</Text>
            <FlatList
              data={logs}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <View style={[styles.timelineRow, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[styles.timelineTime, { color: colors.onSurfaceVariant }]}>{new Date(item.reported_at).toLocaleTimeString()}</Text>
                  <Text style={[styles.timelineCoords, { color: colors.onSurface }]}>{`${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`}</Text>
                </View>
              )}
              contentContainerStyle={{ gap: 8 }}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBarWrap: { paddingTop: 12, paddingHorizontal: 12 },
  topBar: { height: 56, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 10 },
  topBarBack: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 16 },
  liveBadge: { height: 28, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  liveText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, letterSpacing: 0.5 },
  markerWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  markerPulse: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 1 },
  markerCore: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bottomSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 260, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 10 },
  emptyStateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyStateText: { fontFamily: FontFamily.bodyRegular, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaLabel: { fontFamily: FontFamily.bodyRegular, fontSize: 11 },
  metaValue: { fontFamily: FontFamily.bodyMedium, fontSize: 12, marginTop: 2 },
  coordinates: { fontFamily: FontFamily.monoMedium, fontSize: 13 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  timelineTime: { fontFamily: FontFamily.bodyRegular, fontSize: 11 },
  timelineCoords: { fontFamily: FontFamily.monoMedium, fontSize: 11 }
})
