import { useEffect, useRef } from 'react'
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native'

type SkeletonProps = {
  height?: number
  width?: number | `${number}%`
  borderRadius?: number
  style?: StyleProp<ViewStyle>
}

export function Skeleton({
  height = 16,
  width = '100%',
  borderRadius = 10,
  style,
}: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.7,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.3,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    )

    loop.start()
    return () => loop.stop()
  }, [shimmer])

  return (
    <Animated.View
      style={[
        styles.base,
        {
          height,
          width,
          borderRadius,
          opacity: shimmer,
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#282a2f',
  },
})
