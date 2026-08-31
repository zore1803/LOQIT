/**
 * LOQIT auth client (mobile).
 *
 * Same contract as the web client in web/src/lib/authClient.ts, but sessions
 * are persisted with expo-secure-store on device (AsyncStorage on web) and
 * signInWithOAuth returns the URL instead of navigating, because the caller
 * opens it with WebBrowser.openAuthSessionAsync and handles the deep link.
 */
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra as any) || {}
const API_URL = String(
  process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'http://localhost:4000',
).replace(/\/$/, '')

const STORAGE_KEY = 'loqit.auth.session'

export type AuthUser = {
  id: string
  email: string | null
  email_confirmed_at?: string | null
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
  created_at?: string
}

export type AuthSession = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  expires_at: number
  user: AuthUser
}

type AuthErrorShape = { message: string; name?: string } | null
type Result<T> = { data: T; error: AuthErrorShape }

export type AuthChangeEvent =
  | 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'

// ── storage ─────────────────────────────────────────────────────────────────

const store = {
  async get(key: string) {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key)
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value)
    return SecureStore.setItemAsync(key, value)
  },
  async remove(key: string) {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key)
    return SecureStore.deleteItemAsync(key)
  },
}

let current: AuthSession | null = null
let hydrated: Promise<AuthSession | null> | null = null

function hydrate(): Promise<AuthSession | null> {
  if (!hydrated) {
    hydrated = store
      .get(STORAGE_KEY)
      .then((raw) => {
        current = raw ? (JSON.parse(raw) as AuthSession) : null
        return current
      })
      .catch(() => {
        current = null
        return null
      })
  }
  return hydrated
}

async function save(session: AuthSession | null, event: AuthChangeEvent) {
  current = session
  hydrated = Promise.resolve(session)
  try {
    if (session) await store.set(STORAGE_KEY, JSON.stringify(session))
    else await store.remove(STORAGE_KEY)
  } catch (err) {
    console.warn('[auth] could not persist session:', err)
  }
  emit(event, session)
}

// ── change subscribers ──────────────────────────────────────────────────────

type Listener = (event: AuthChangeEvent, session: AuthSession | null) => void
const listeners = new Set<Listener>()

function emit(event: AuthChangeEvent, session: AuthSession | null) {
  for (const fn of listeners) {
    try {
      fn(event, session)
    } catch (err) {
      console.error('[auth] listener error:', err)
    }
  }
}

// ── transport ───────────────────────────────────────────────────────────────

async function call<T = any>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<Result<T>> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (options.token) headers.Authorization = `Bearer ${options.token}`

    const res = await fetch(`${API_URL}/auth${path}`, {
      method: options.method || 'POST',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const json = await res
      .json()
      .catch(() => ({ data: null, error: { message: `HTTP ${res.status}` } }))
    return json as Result<T>
  } catch (err) {
    return {
      data: null as T,
      error: { message: err instanceof Error ? err.message : 'Network error' },
    }
  }
}

// ── refresh ─────────────────────────────────────────────────────────────────

let refreshing: Promise<AuthSession | null> | null = null

async function refresh(): Promise<AuthSession | null> {
  const session = await hydrate()
  if (!session?.refresh_token) return null
  if (refreshing) return refreshing

  refreshing = (async () => {
    const { data, error } = await call<{ session: AuthSession }>('/refresh', {
      body: { refresh_token: session.refresh_token },
    })
    if (error || !data?.session) {
      await save(null, 'SIGNED_OUT')
      return null
    }
    await save(data.session, 'TOKEN_REFRESHED')
    return data.session
  })()

  try {
    return await refreshing
  } finally {
    refreshing = null
  }
}

async function validSession(): Promise<AuthSession | null> {
  const session = await hydrate()
  if (!session) return null
  const secondsLeft = session.expires_at - Math.floor(Date.now() / 1000)
  if (secondsLeft > 60) return session
  return refresh()
}

/** Used by lib/db.ts and the background tasks to authorise requests. */
export async function getAccessToken(): Promise<string | null> {
  const session = await validSession()
  return session?.access_token ?? null
}

// ── the supabase.auth-compatible surface ────────────────────────────────────

export const auth = {
  async getSession(): Promise<Result<{ session: AuthSession | null }>> {
    const session = await validSession()
    return { data: { session }, error: null }
  },

  async getUser(): Promise<Result<{ user: AuthUser | null }>> {
    const session = await validSession()
    if (!session) return { data: { user: null }, error: null }
    const { data, error } = await call<{ user: AuthUser }>('/user', {
      method: 'GET',
      token: session.access_token,
    })
    return { data: { user: data?.user ?? null }, error }
  },

  async signUp(credentials: {
    email: string
    password: string
    options?: { data?: Record<string, any>; emailRedirectTo?: string }
  }) {
    const { data, error } = await call<{ user: AuthUser; session: AuthSession }>('/signup', {
      body: {
        email: credentials.email,
        password: credentials.password,
        data: credentials.options?.data || {},
      },
    })
    if (error) return { data: { user: null, session: null }, error }
    await save(data.session, 'SIGNED_IN')
    return { data: { user: data.user, session: data.session }, error: null }
  },

  async signInWithPassword(credentials: { email: string; password: string }) {
    const { data, error } = await call<{ user: AuthUser; session: AuthSession }>('/login', {
      body: credentials,
    })
    if (error) return { data: { user: null, session: null }, error }
    await save(data.session, 'SIGNED_IN')
    return { data: { user: data.user, session: data.session }, error: null }
  },

  /**
   * Returns the URL to open — the caller drives the browser session itself and
   * completes the login from the redirect (see lib/authSession.ts).
   */
  async signInWithOAuth(options: {
    provider: string
    options?: { redirectTo?: string; queryParams?: Record<string, string> }
  }): Promise<Result<{ provider: string; url: string | null }>> {
    if (options.provider !== 'google') {
      return {
        data: { provider: options.provider, url: null },
        error: { message: `Unsupported provider: ${options.provider}` },
      }
    }
    const redirectTo = options.options?.redirectTo || ''
    if (!redirectTo) {
      return { data: { provider: 'google', url: null }, error: { message: 'Missing redirect URL' } }
    }
    const url = `${API_URL}/auth/google/start?redirect_to=${encodeURIComponent(redirectTo)}`
    return { data: { provider: 'google', url }, error: null }
  },

  async exchangeCodeForSession(codeOrUrl: string) {
    let code = codeOrUrl
    if (codeOrUrl.includes('://') || codeOrUrl.includes('?')) {
      const match = codeOrUrl.match(/[?&#]code=([^&]+)/)
      code = match ? decodeURIComponent(match[1]) : ''
    }
    if (!code) {
      return {
        data: { user: null, session: null },
        error: { message: 'No auth code found in callback URL' },
      }
    }
    const { data, error } = await call<{ user: AuthUser; session: AuthSession }>('/exchange', {
      body: { code },
    })
    if (error) return { data: { user: null, session: null }, error }
    await save(data.session, 'SIGNED_IN')
    return { data: { user: data.user, session: data.session }, error: null }
  },

  async setSession(tokens: { access_token: string; refresh_token: string }) {
    const { data, error } = await call<{ session: AuthSession }>('/refresh', {
      body: { refresh_token: tokens.refresh_token },
    })
    if (error || !data?.session) {
      return {
        data: { user: null, session: null },
        error: error || { message: 'Could not restore session' },
      }
    }
    await save(data.session, 'SIGNED_IN')
    return { data: { user: data.session.user, session: data.session }, error: null }
  },

  async refreshSession() {
    const session = await refresh()
    if (!session) {
      return { data: { user: null, session: null }, error: { message: 'Could not refresh session' } }
    }
    return { data: { user: session.user, session }, error: null }
  },

  async signOut(_options?: { scope?: string }): Promise<{ error: AuthErrorShape }> {
    const session = await hydrate()
    if (session?.refresh_token) {
      await call('/logout', { body: { refresh_token: session.refresh_token } })
    }
    await save(null, 'SIGNED_OUT')
    return { error: null }
  },

  async updateUser(attributes: { password?: string; email?: string; data?: Record<string, any> }) {
    const session = await validSession()
    if (!session) return { data: { user: null }, error: { message: 'Not signed in' } }

    const { data, error } = await call<{ user: AuthUser }>('/user', {
      method: 'PATCH',
      token: session.access_token,
      body: attributes,
    })
    if (error) return { data: { user: null }, error }

    if (attributes.password) {
      await save(null, 'SIGNED_OUT')
    } else {
      await save({ ...session, user: data.user }, 'USER_UPDATED')
    }
    return { data: { user: data.user }, error: null }
  },

  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    return call('/password/request', { body: { email, redirect_to: options?.redirectTo } })
  },

  async resetPassword(token: string, password: string) {
    return call('/password/reset', { body: { token, password } })
  },

  onAuthStateChange(callback: Listener) {
    listeners.add(callback)
    hydrate().then((session) => callback('INITIAL_SESSION', session))
    return {
      data: { subscription: { unsubscribe: () => listeners.delete(callback) } },
    }
  },

  // Email verification runs through the n8n webhooks in hooks/useAuth.tsx;
  // SMS OTP was never wired to a provider.
  async verifyOtp(_params: Record<string, any>) {
    return { data: { user: null, session: null }, error: { message: 'SMS OTP is not enabled' } }
  },

  async resend(_params: Record<string, any>) {
    return { data: null, error: { message: 'SMS OTP is not enabled' } }
  },
}

export const authClient = { auth }
