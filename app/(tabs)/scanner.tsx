import { useCallback, useEffect, useState, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { bleService } from '../../services/ble.service'
import { supabase } from '../../lib/supabase'
import { GradientButton } from '../../components/ui/GradientButton'
import { Toast } from '../../components/ui/Toast'
import * as Location from 'expo-location'
import { hasServicesEnabledAsync } from 'expo-location'

type DetectedDevice = {
  beaconId: string
  rssi: number
  distanceMeters: number | null
  deviceId: string | null
  owner_id: string | null
  make: string | null
  model: string | null
  status: string
  seenAt: string
}

export default function ScannerScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const { user } = useAuth()
  const [isScanning, setIsScanning] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [allDevices, setAllDevices] = useState<any[]>([])
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([])
  const [lostAlertDevice, setLostAlertDevice] = useState<DetectedDevice | null>(null)
  const [toast, setToast] = useState({ message: '', type: 'info' as 'info' | 'success' | 'error' })
  
  // Local cache of lost devices for instant matching
  const lostRepo = useRef<any[]>([])
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem('loqit_my_active_device_id').then(setMyDeviceId)
  }, [])


  const ringOne = useRef(new Animated.Value(0)).current
  const ringTwo = useRef(new Animated.Value(0)).current
  const ringThree = useRef(new Animated.Value(0)).current

  const startPulse = useCallback((anim: Animated.Value, delay: number) => {
    return Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    )
  }, [])

  useEffect(() => {
    if (!isScanning) {
      ringOne.setValue(0); ringTwo.setValue(0); ringThree.setValue(0);
      return
    }
    const anims = [startPulse(ringOne, 0), startPulse(ringTwo, 1000), startPulse(ringThree, 2000)]
    anims.forEach(a => a?.start())
    return () => anims.forEach(a => a?.stop())
  }, [isScanning, ringOne, ringTwo, ringThree, startPulse])

  const findMatch = useCallback((beaconId: string, name?: string) => {
    const id = beaconId.toLowerCase()
    const cleanName = name?.toLowerCase() || ''
    
    return lostRepo.current.find(dev => {
      // 0. EXCLUDE THIS PHYSICAL PHONE (Self)
      if (myDeviceId && dev.id === myDeviceId) return false;

      // 1. Direct ID match (Bluetooth or DB PK)
      if (dev.id?.toLowerCase() === id) return true
      if (dev.ble_device_uuid?.toLowerCase() === id) return true
      if (dev.ble_beacon_id?.toLowerCase() === id) return true
      
      // 2. Fuzzy name match
      if (cleanName.length > 3) {
        const make = dev.make?.toLowerCase() || ''
        const model = dev.model?.toLowerCase() || ''
        if (cleanName.includes(make) || cleanName.includes(model)) return true
        if (make.includes(cleanName) || model.includes(cleanName)) return true
      }
      return false
    })
  }, [user])

  // fromGps=true means it came from GPS proximity (not a real BLE signal) — never triggers the alert modal
  const upsertDevice = useCallback(async (beaconId: string, rssi: number, name?: string, fromGps = false) => {
    // 1. Local Cache Match (High Speed)
    let matched = findMatch(beaconId, name)
    
    // 2. Server Fallback (Deep Scan - if not in local registry or registry didn't load)
    if (!matched) {
      const searchVal = beaconId.trim().toLowerCase()
      const { data: serverMatch } = await supabase
        .from('devices')
        .select('*')
        .or(`id.eq.${searchVal},ble_device_uuid.eq.${searchVal},ble_beacon_id.eq.${searchVal}`)
        .limit(1)
        .maybeSingle()
      
      if (serverMatch) matched = serverMatch
    }

    if (!matched) return

    const next: DetectedDevice = {
      beaconId: matched.ble_beacon_id || beaconId,
      rssi,
      distanceMeters: Math.pow(10, (-59 - rssi) / 22),
      deviceId: matched.id,
      owner_id: matched.owner_id,
      make: matched.make,
      model: matched.model,
      status: matched.status,
      seenAt: new Date().toISOString(),
    }

    setDetectedDevices((curr) => {
      const other = curr.filter((d) => d.beaconId !== next.beaconId)
      return [next, ...other].slice(0, 10)
    })

    // Only show the alert modal for real BLE detections, not GPS proximity matches
    if (!fromGps && (next.status === 'lost' || next.status === 'stolen')) {
      setLostAlertDevice(next)
    }
  }, [findMatch])

  // Keep the lost-device registry refreshed (runs on mount, not tied to scan state)
  useEffect(() => {
    const fetchRegistry = async () => {
      const { data } = await supabase.from('devices').select('*').in('status', ['lost', 'stolen'])
      if (data) {
        lostRepo.current = data
        console.log(`[Scanner] Lost Registry updated: ${data.length} devices`)
      }
    }

    fetchRegistry()
    const registryInterval = setInterval(fetchRegistry, 30000) // refresh every 30s

    return () => {
      clearInterval(registryInterval)
      bleService.stopScan()
    }
  }, [])

  // GPS proximity check — only runs while the user has actively started scanning
  // Uses 50m radius; does NOT trigger the "device found" alert modal (fromGps=true)
  useEffect(() => {
    if (!isScanning) return

    let proximityInterval: NodeJS.Timeout | null = null

    const checkGpsProximity = async () => {
      if (lostRepo.current.length === 0) return
      try {
        const userLoc = await Location.getLastKnownPositionAsync({})
          || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (!userLoc) return

        const lat1 = userLoc.coords.latitude
        const lon1 = userLoc.coords.longitude

        lostRepo.current.forEach(dev => {
          if (myDeviceId && dev.id === myDeviceId) return
          if (!dev.last_seen_lat || !dev.last_seen_lng) return

          const lat2 = dev.last_seen_lat
          const lon2 = dev.last_seen_lng
          const R = 6371e3
          const φ1 = lat1 * Math.PI / 180
          const φ2 = lat2 * Math.PI / 180
          const Δφ = (lat2 - lat1) * Math.PI / 180
          const Δλ = (lon2 - lon1) * Math.PI / 180
          const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2)
            + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
          const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

          // 50m radius — tight enough to mean the device is genuinely nearby
          if (d < 50) {
            console.log(`[Scanner] 📍 GPS MATCH within 50m: ${dev.make} (~${d.toFixed(0)}m)`)
            // fromGps=true: shows in list but does NOT open the "Lost device found nearby!" modal
            upsertDevice(dev.id, -70, `GPS-${dev.model}`, true)
            bleService.reportDetectedLostDevice(dev.id, -70, `GPS-${dev.model}`)
          }
        })
      } catch (gpsErr) {
        console.warn('[Scanner] GPS proximity check failed:', gpsErr)
      }
    }

    checkGpsProximity()
    proximityInterval = setInterval(checkGpsProximity, 15000) // every 15s while scanning

    return () => {
      if (proximityInterval) clearInterval(proximityInterval)
    }
  }, [isScanning, upsertDevice, myDeviceId])

  const toggleScan = async () => {
    if (isScanning) {
      bleService.stopScan()
      setIsScanning(false)
      return
    }

    const hasPerms = await bleService.requestScanPermissions()
    if (!hasPerms) {
      setToast({ message: 'Permissions required', type: 'error' })
      return
    }
    
    const hasLocationServices = await hasServicesEnabledAsync()
    if (!hasLocationServices) {
      setToast({ message: 'GPS/Location must be enabled to scan.', type: 'error' })
      return
    }

    if (showAll) {
      bleService.scanForAllDevices((dev) => {
        setAllDevices((curr) => {
          const other = curr.filter((d) => d.id !== dev.id)
          return [{ ...dev, seenAt: Date.now() }, ...other].slice(0, 20)
        })
      })
    } else {
      bleService.scanForLOQITDevices((b, r, n) => {
        upsertDevice(b, r, n)
      })
    }
    setIsScanning(true)
  }

  useEffect(() => {
    if (isScanning) {
      bleService.stopScan()
      if (showAll) {
        bleService.scanForAllDevices((dev) => {
          setAllDevices((curr) => {
            const other = curr.filter((d) => d.id !== dev.id)
            return [{ ...dev, seenAt: Date.now() }, ...other].slice(0, 20)
          })
        })
      } else {
        bleService.scanForLOQITDevices((b, r, n) => {
          upsertDevice(b, r, n)
        })
      }
    }
  }, [showAll, upsertDevice])

  const startChat = (device: DetectedDevice) => {
    if (!device.deviceId) return
    router.push({ pathname: '/(tabs)/chat', params: { deviceId: device.deviceId, initialMsg: `Hello, I found your ${device.make} ${device.model} nearby.` } })
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <Toast visible={!!toast.message} message={toast.message} type={toast.type} onHide={() => setToast({ message: '', type: 'info' })} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.radarCard, { backgroundColor: colors.surfaceContainerLow }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={toggleScan} style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
            {[ringOne, ringTwo, ringThree].map((v, i) => (
              <Animated.View key={i} style={[styles.pulseRing, { borderColor: `${colors.primary}B3`, backgroundColor: `${colors.primary}1A`, opacity: isScanning ? v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] }) : 0, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1.38] }) }] }]} />
            ))}
            <View style={[styles.centerIconWrap, { backgroundColor: `${colors.onSurface}12` }]}>
              <MaterialIcons name={isScanning ? 'bluetooth-searching' : 'bluetooth'} size={40} color={colors.primary} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.protocolText, { color: colors.outline }]}>Registry: {lostRepo.current.length} Lost Devices</Text>
          <Text style={[styles.scanStatus, { color: colors.onSurface }]}>{isScanning ? 'Scanner active' : 'Scanner paused'}</Text>
          <View style={{ marginTop: 8, width: 220 }}>
            <GradientButton title={isScanning ? "Stop Scanning" : "Start Scanning"} onPress={toggleScan} />
          </View>
        </View>

        <View style={[styles.activeStatusCard, { backgroundColor: `${colors.secondary}15`, justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MaterialIcons name="security" size={20} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontFamily: FontFamily.bodyMedium }}>{showAll ? 'Scanning for ALL devices' : 'LOQIT Security Mode'}</Text>
          </View>
          <Pressable onPress={() => setShowAll(!showAll)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.surfaceContainerHigh }}>
            <Text style={{ color: colors.primary, fontSize: 11, fontFamily: FontFamily.headingBold }}>{showAll ? 'MODE: ALL' : 'MODE: LOQIT'}</Text>
          </Pressable>
        </View>

        {showAll ? allDevices.map((item) => (
          <View key={item.id} style={[styles.deviceCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.deviceIconWrap, { backgroundColor: `${colors.outlineVariant}24` }]}><MaterialIcons name="settings-input-antenna" size={18} color={colors.outline} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.deviceNameStyle, { color: colors.onSurface }]}>{item.name}</Text><Text style={[styles.beaconIdText, { color: colors.outline }]}>{item.id}</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={{ color: colors.primary, fontSize: 12, fontFamily: FontFamily.monoMedium }}>{item.rssi} dBm</Text></View>
            </View>
          </View>
        )) : detectedDevices.map((item) => (
          <View key={item.beaconId} style={[styles.deviceCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.deviceIconWrap, { backgroundColor: `${colors.primary}24` }]}><MaterialIcons name="bluetooth-searching" size={18} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.deviceNameStyle, { color: colors.onSurface }]}>{item.make ? `${item.make} ${item.model}` : 'LOQIT Device'}</Text><Text style={[styles.beaconIdText, { color: colors.outline }]}>{item.make ? `Beacon: ${item.beaconId}` : `ID: ${item.beaconId.slice(0, 16)}…`}</Text></View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <View style={[styles.distanceBadge, { backgroundColor: item.rssi > -60 ? `${colors.secondary}20` : `${colors.outlineVariant}20` }]}>
                  <Text style={[styles.distanceText, { color: item.rssi > -60 ? colors.secondary : colors.onSurfaceVariant }]}>{item.distanceMeters ? `~${item.distanceMeters.toFixed(1)}m` : '---'}</Text>
                </View>
              </View>
            </View>
            <Pressable style={[styles.helpButton, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }]} onPress={() => startChat(item)}>
              <Text style={[styles.helpButtonText, { color: colors.primary }]}>
                {item.beaconId.startsWith('GPS-') ? 'Recover via GPS' : 'Help Return (Contact Owner)'}
              </Text>
            </Pressable>
          </View>
        ))}

        <View style={[styles.footerInfoCard, { backgroundColor: `${colors.secondary}1A`, borderColor: `${colors.secondary}33` }]}>
          <MaterialIcons name="verified-user" size={16} color={colors.secondary} />
          <Text style={[styles.footerInfoText, { color: colors.secondary }]}>Scanner helps detect lost devices securely.</Text>
        </View>
      </ScrollView>

      <Modal visible={!!lostAlertDevice} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainer }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Lost device found nearby!</Text>
            <Text style={{ color: colors.onSurfaceVariant, marginBottom: 12 }}>A {lostAlertDevice?.make} {lostAlertDevice?.model} has been detected. The owner has been notified of your location.</Text>
            <GradientButton title="Contact Owner Anonymously" onPress={() => startChat(lostAlertDevice!)} />
            <Pressable onPress={() => setLostAlertDevice(null)} style={{ paddingVertical: 10 }}>
              <Text style={[styles.cancelActionText, { color: colors.onSurfaceVariant }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 120, gap: 14 },
  radarCard: { width: '100%', borderRadius: 24, paddingVertical: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 10 },
  pulseRing: { position: 'absolute', width: 188, height: 188, borderRadius: 94, borderWidth: 1 },
  centerIconWrap: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  protocolText: { fontFamily: FontFamily.monoMedium, fontSize: 11 },
  scanStatus: { fontFamily: FontFamily.headingSemiBold, fontSize: 17 },
  deviceCard: { borderRadius: 12, padding: 12, gap: 10 },
  deviceIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deviceNameStyle: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  beaconIdText: { fontFamily: FontFamily.monoMedium, fontSize: 10, marginTop: 1 },
  signalBar: { width: 3, borderRadius: 2 },
  rssiText: { fontFamily: FontFamily.monoMedium, fontSize: 10 },
  helpButton: { minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  helpButtonText: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  footerInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  footerInfoText: { flex: 1, fontFamily: FontFamily.bodyRegular, fontSize: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 24, paddingTop: 10, gap: 12 },
  sheetHandle: { width: 48, height: 5, borderRadius: 999, alignSelf: 'center' },
  modalTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 19 },
  cancelActionText: { textAlign: 'center', fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  distanceBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  distanceText: { fontFamily: FontFamily.monoMedium, fontSize: 13 },
  activeStatusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, marginBottom: 4 },
})