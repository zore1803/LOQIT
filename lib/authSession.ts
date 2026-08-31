import * as Linking from 'expo-linking'
import { supabase } from './supabase'

/**
 * Completes an auth session from an OAuth redirect URL.
 *
 * Nothing establishes the session automatically on mobile, so this helper is
 * the single place that knows how to read a one-time code (or tokens) out of a
 * redirect URL and turn it into a real session — used by:
 *   - hooks/useAuth.tsx        (warm flow: res.url from openAuthSessionAsync)
 *   - app/_layout.tsx          (warm/background deep link + cold start)
 *   - app/auth/callback.tsx    (cold start fallback)
 *
 * Keeping one implementation prevents the three paths from drifting apart.
 */
export type CompleteSessionResult =
  | { status: 'completed' }
  | { status: 'no-credentials' }
  | { status: 'error'; error: unknown }

export function extractAuthCredentialsFromUrl(url: string) {
  const parsed = Linking.parse(url)
  const hash = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null

  const accessToken =
    (parsed.queryParams?.access_token as string) || hash?.get('access_token') || ''
  const refreshToken =
    (parsed.queryParams?.refresh_token as string) || hash?.get('refresh_token') || ''
  const code = (parsed.queryParams?.code as string) || hash?.get('code') || ''

  return { accessToken, refreshToken, code }
}

// The same redirect URL can reach us through up to three paths at once
// (openAuthSessionAsync result, the global Linking listener, and the
// auth/callback route). Only the first caller should hit the network;
// the rest await the same in-flight promise instead of re-running
// setSession/exchangeCodeForSession (an auth code is single-use, so a
// second exchange would fail and stall the login with error retries).
const inFlightByUrl = new Map<string, Promise<CompleteSessionResult>>()

export async function completeSessionFromUrl(url: string): Promise<CompleteSessionResult> {
  const existing = inFlightByUrl.get(url)
  if (existing) return existing

  const task = completeSessionFromUrlUncached(url).then((result) => {
    // Keep successful completions cached (the code is spent); allow retries
    // for failures so a transient network error doesn't dead-end the login.
    if (result.status !== 'completed') inFlightByUrl.delete(url)
    return result
  })
  inFlightByUrl.set(url, task)
  return task
}

async function completeSessionFromUrlUncached(url: string): Promise<CompleteSessionResult> {
  try {
    const { accessToken, refreshToken, code } = extractAuthCredentialsFromUrl(url)

    if (accessToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })
      if (error) return { status: 'error', error }
      return { status: 'completed' }
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) return { status: 'error', error }
      return { status: 'completed' }
    }

    return { status: 'no-credentials' }
  } catch (error) {
    return { status: 'error', error }
  }
}
