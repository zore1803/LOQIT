import { PropsWithChildren } from 'react'
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

import { Colors, ColorPalette } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { Skeleton } from './Skeleton'

type StructuredLoaderProps = PropsWithChildren<{
  colors?: ColorPalette
  message?: string
  overlay?: boolean
  variant?: 'app' | 'dashboard' | 'pairing'
  style?: ViewStyle
}>

function LoaderBlock({
  colors,
  height,
  width = '100%',
  radius = 12,
  style,
}: {
  colors: ColorPalette
  height: number
  width?: number | `${number}%`
  radius?: number
  style?: ViewStyle
}) {
  return (
    <Skeleton
      height={height}
      width={width}
      borderRadius={radius}
      style={[{ backgroundColor: colors.surfaceContainerHighest }, style]}
    />
  )
}

function HeaderSkeleton({ colors }: { colors: ColorPalette }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={[styles.brandIcon, { backgroundColor: colors.primaryContainer }]}>
          <MaterialIcons name="shield" size={16} color={colors.primary} />
        </View>
        <LoaderBlock colors={colors} width={64} height={14} radius={7} />
      </View>
      <View style={styles.actionRow}>
        <LoaderBlock colors={colors} width={38} height={38} radius={19} />
        <LoaderBlock colors={colors} width={38} height={38} radius={19} />
      </View>
    </View>
  )
}

function DashboardSkeleton({ colors, compact = false }: { colors: ColorPalette; compact?: boolean }) {
  return (
    <View style={[styles.content, compact && styles.compactContent]}>
      <View style={styles.heroBlock}>
        <LoaderBlock colors={colors} width="44%" height={14} />
        <LoaderBlock colors={colors} width="72%" height={30} radius={10} />
        <LoaderBlock colors={colors} width="58%" height={12} />
      </View>

      <View style={[styles.banner, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
        <LoaderBlock colors={colors} width={40} height={40} radius={12} />
        <View style={styles.flexGap}>
          <LoaderBlock colors={colors} width="64%" height={13} />
          <LoaderBlock colors={colors} width="42%" height={11} />
        </View>
      </View>

      <View style={styles.statsRow}>
        {[0, 1, 2].map(item => (
          <View key={item} style={[styles.statCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <LoaderBlock colors={colors} width={36} height={28} radius={9} />
            <LoaderBlock colors={colors} width={48} height={10} radius={5} />
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <LoaderBlock colors={colors} width={118} height={18} radius={8} />
        <LoaderBlock colors={colors} width={58} height={24} radius={10} />
      </View>

      <View style={styles.deviceRow}>
        {[0, 1].map(item => (
          <View key={item} style={[styles.deviceCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <LoaderBlock colors={colors} width="58%" height={16} />
            <LoaderBlock colors={colors} width="42%" height={11} />
            <View style={styles.deviceMetaRow}>
              <LoaderBlock colors={colors} width={44} height={44} radius={14} />
              <View style={styles.flexGap}>
                <LoaderBlock colors={colors} width="72%" height={11} />
                <LoaderBlock colors={colors} width="54%" height={11} />
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.quickGrid}>
        {[0, 1, 2, 3].map(item => (
          <View key={item} style={[styles.quickCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <LoaderBlock colors={colors} width={36} height={36} radius={10} />
            <LoaderBlock colors={colors} width="58%" height={12} radius={6} />
          </View>
        ))}
      </View>
    </View>
  )
}

export function StructuredLoader({
  colors = Colors,
  message,
  overlay = false,
  variant = 'dashboard',
  style,
  children,
}: StructuredLoaderProps) {
  const isDark = colors.background.toLowerCase() !== '#ffffff'
  const compact = variant !== 'dashboard'

  return (
    <View
      pointerEvents={overlay ? 'auto' : 'box-none'}
      style={[
        overlay ? StyleSheet.absoluteFill : styles.root,
        { backgroundColor: overlay ? `${colors.background}D9` : colors.background },
        style,
      ]}
    >
      <View style={styles.skeletonLayer}>
        <HeaderSkeleton colors={colors} />
        <DashboardSkeleton colors={colors} compact={compact} />
      </View>

      <BlurView
        pointerEvents="none"
        intensity={Platform.OS === 'ios' ? 34 : 18}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: overlay ? `${colors.background}99` : `${colors.background}55` },
        ]}
      />

      {(message || children) && (
        <View style={styles.statusWrap}>
          {message ? (
            <View style={[styles.statusPill, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <LoaderBlock colors={colors} width={28} height={28} radius={14} />
              <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]}>{message}</Text>
            </View>
          ) : null}
          {children}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  skeletonLayer: {
    flex: 1,
    opacity: 0.72,
  },
  header: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
    gap: 18,
  },
  compactContent: {
    paddingTop: 28,
    opacity: 0.82,
  },
  heroBlock: {
    gap: 8,
  },
  banner: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flexGap: {
    flex: 1,
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deviceCard: {
    width: 200,
    minHeight: 154,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  deviceMetaRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48.5%',
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  statusPill: {
    minHeight: 56,
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    flexShrink: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
  },
})
