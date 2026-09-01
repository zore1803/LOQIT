import { Redirect } from 'expo-router'

/**
 * Expo Router's root `/` route. Never actually rendered as a resting screen —
 * navigating directly from this bare, ungrouped route into the `(tabs)` group
 * was found to force the entire app tree (AuthProvider included) to unmount
 * and remount, which showed up as a black flash right after the dashboard
 * appeared. Redirecting unconditionally into the `(auth)` group here means
 * AuthGate (app/_layout.tsx) instead does a group-to-group hop — `(auth)` to
 * `(tabs)` — when a session already exists, which does not trigger the same
 * remount.
 */
export default function IndexRoute() {
  return <Redirect href="/(auth)/onboarding" />
}
