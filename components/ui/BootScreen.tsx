import { PropsWithChildren } from 'react'
import { StyleSheet, Text, View } from 'react-native'

type BootScreenProps = PropsWithChildren<{
  message?: string
  /** 0-1 */
  progress?: number
}>

/**
 * The single screen shown for the entire window between "user tapped sign
 * in" and "dashboard has real data on screen." Deliberately bare — a plain
 * white page with one progress bar — so nothing else (logo splash, skeleton
 * mockups, differently-worded status pills) can flash past underneath or
 * between renders. app/_layout.tsx drives `progress` from one boot-stage
 * number; app/index.tsx renders this same screen so Expo Router's transient
 * landing on `/` during navigation looks identical rather than flashing a
 * different splash screen.
 */
export function BootScreen({ message, progress, children }: BootScreenProps) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.max(4, Math.min(100, (progress ?? 0) * 100))}%` },
            ]}
          />
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '70%',
    maxWidth: 280,
    alignItems: 'center',
    gap: 14,
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#2776EA',
  },
  message: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
})
