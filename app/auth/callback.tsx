import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { completeSessionFromUrl } from '../../lib/authSession'

/**
 * Landing screen for the loqit://auth/callback deep link. Android's own
 * file-based routing navigates here independently of the global Linking
 * listener in app/_layout.tsx (handleLoginUrl) — both fire on the same
 * redirect. That listener is the reliable, single source of truth for
 * completing the OAuth exchange and for deciding where to route once the
 * session and profile are ready (with its own 45s/retry budget for a slow
 * Render cold start).
 *
 * This screen used to make that same decision independently, using its own
 * shorter timeout — and would sign the user out if `profile` was merely still
 * loading, mistaking "not loaded yet" for "no account exists." That raced
 * with the real profile fetch and wiped sessions that were actually fine.
 * It now does nothing but wait: AuthGate (app/_layout.tsx) owns navigation
 * away from this screen once auth actually settles, and its single boot
 * screen covers this whole window so there's nothing to render here.
 */
export default function AuthCallback() {
  useEffect(() => {
    // Harmless if app/_layout.tsx's listener already completed the exchange —
    // completeSessionFromUrl dedupes by URL and returns the cached result.
    // Only useful as a fallback if this screen is somehow reached first.
    Linking.getInitialURL().then((url) => {
      if (url) void completeSessionFromUrl(url)
    })
  }, [])

  // Renders nothing — the root layout's single boot screen (app/_layout.tsx)
  // already covers the screen for this entire window, so this doesn't need
  // its own competing loader.
  return null
}
