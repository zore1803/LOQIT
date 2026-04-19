import { useRef } from 'react'
import {
  Animated,
  DimensionValue,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'

import { FontFamily } from '../../constants/typography'
import { useTheme } from '../../hooks/useTheme'

type DeviceCardProps = {
  id: string
  make: string
  model: string
  serial: string
  status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
  onPress?: (id: string) => void
  style?: StyleProp<ViewStyle>
  width?: DimensionValue
}

export function DeviceCard({
  id,
  make,
  model,
  serial,
  status,
  onPress,
  style,
  width = 200,
}: DeviceCardProps) {
  const { colors } = useTheme()
  const serialTail = serial?.length > 4 ? serial.slice(-4) : serial || '0000'
  const scale = useRef(new Animated.Value(1)).current

  const statusConfig = {
    registered: { label: 'SAFE', color: colors.secondary },
    recovered: { label: 'RECOVERED', color: colors.secondary },
    found: { label: 'FOUND', color: colors.tertiary },
    lost: { label: 'LOST', color: colors.error },
    stolen: { label: 'STOLEN', color: colors.error },
  } as const

  const cfg = statusConfig[status] || statusConfig.registered

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      damping: 18,
      stiffness: 240,
      mass: 0.6,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        style={[styles.card, { width, backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
        onPress={() => onPress?.(id)}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <MaterialIcons name="smartphone" size={22} color="#fff" />
        </LinearGradient>

        <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}1A` }]}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.deviceName, { color: colors.onSurface }]} numberOfLines={1}>{`${make} ${model}`}</Text>
          <Text style={[styles.imeiText, { color: colors.outline }]}>{`SN •••• ${serialTail}`}</Text>
        </View>

        <View style={styles.arrow}>
          <MaterialIcons name="arrow-forward-ios" size={12} color={colors.outline} />
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  info: {
    marginTop: 2,
    gap: 3,
  },
  deviceName: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
  },
  imeiText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  arrow: {
    position: 'absolute',
    bottom: 14,
    right: 14,
  },
})
