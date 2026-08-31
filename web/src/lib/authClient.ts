/**
 * LOQIT auth client.
 *
 * Drop-in replacement for the parts of `supabase.auth` the app used. Auth is
 * now issued by the LOQIT API (server/) against MongoDB: email + password and
 * Google OAuth, with our own JWTs. Keeping the method names and return shapes
 * identical means the ~50 files that call `supabase.auth.*` need no changes.
 *
 * Sessions live in localStorage and the access token is refreshed on demand.
 */

const API_URL = ((import.meta as any).env?.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
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

type Result<T> = { data: T; error: { message: string; name?: string } | null }

export type AuthChangeEvent =
  | 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'

// ── session storage ─────────────────────────────────────────────────────────

let current: AuthSession | null = null
let loaded = false

function load(): AuthSession | null {
  if (loaded) return current
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    current = raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    current = null
  }
  return current
}

function save(session: AuthSession | null, event: AuthChangeEvent) {
  current = session
  loaded = true
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode / storage disabled — session stays in memory only */
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

    const json = await res.json().catch(() => ({ data: null, error: { message: `HTTP ${res.status}` } }))
    return json as Result<T>
  } catch (err) {
    return {
      data: null as T,
      error: { message: err instanceof Error ? err.message : 'Network error' },
    }
  }
}

// ── token refresh ───────────────────────────────────────────────────────────

let refreshing: Promise<AuthSession | null> | null = null

async function refresh(): Promise<AuthSession | null> {
  const session = load()
  if (!session?.refresh_token) return null

  // Collapse concurrent refreshes — several hooks call getSession() at once on
  // first paint, and rotation would invalidate all but the first token.
  if (refreshing) return refreshing

  refreshing = (async () => {
    const { data, error } = await call<{ session: AuthSession }>('/refresh', {
      body: { refresh_token: session.refresh_token },
    })
    if (error || !data?.session) {
      save(null, 'SIGNED_OUT')
      return null
    }
    save(data.session, 'TOKEN_REFRESHED')
    return data.session
  })()

  try {
    return await refreshing
  } finally {
    refreshing = null
  }
}

/** Returns a valid session, refreshing it if it is expired or nearly so. */
async function validSession(): Promise<AuthSession | null> {
  const session = load()
  if (!session) return null
  const secondsLeft = session.expires_at - Math.floor(Date.now() / 1000)
  if (secondsLeft > 60) return session
  return refresh()
}

/** Used by the data layer (db.ts) to authorise every request. */
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
  }): Promise<Result<{ user: AuthUser | null; session: AuthSession | null }>> {
    const { data, error } = await call<{ user: AuthUser; session: AuthSession }>('/signup', {
      body: {
        email: credentials.email,
        password: credentials.password,
        data: credentials.options?.data || {},
      },
    })
    if (error) return { data: { user: null, session: null }, error }
    save(data.session, 'SIGNED_IN')
    return { data: { user: data.user, session: data.session }, error: null }
  },

  async signInWithPassword(credentials: { email: string; password: string }) {
    const { data, error } = await call<{ user: AuthUser; session: AuthSession }>('/login', {
      body: credentials,
    })
    if (error) return { data: { user: null, session: null }, error }
    save(data.session, 'SIGNED_IN')
    return { data: { user: data.user, session: data.session }, error: null }
  },

  /**
   * Sends the browser to the server, which redirects on to Google. The client
   * secret stays on the server — the browser never sees it.
   */
  async signInWithOAuth(options: {
    provider: string
    options?: { redirectTo?: string; queryParams?: Record<string, string> }
  }): Promise<Result<{ provider: string; url: string | null }>> {
    if (options.provider !== 'google') {
      return { data: { provider: options.provider, url: null }, error: { message: `Unsupported provider: ${options.provider}` } }
    }
    const redirectTo = options.options?.redirectTo || `${window.location.origin}/auth/callback`
    const url = `${API_URL}/auth/google/start?redirect_to=${encodeURIComponent(redirectTo)}`
    window.location.assign(url)
    return { data: { provider: 'google', url }, error: null }
  },

  /**
   * Completes the Google round-trip. Accepts a bare code or the full callback
   * URL, since the old Supabase call was given `window.location.href`.
   */
  async exchangeCodeForSession(codeOrUrl: string) {
    let code = codeOrUrl
    if (codeOrUrl.includes('://') || codeOrUrl.includes('?')) {
      try {
        code = new URL(codeOrUrl, window.location.origin).searchParams.get('code') || ''
      } catch {
        code = ''
      }
    }
    if (!code) {
      return { data: { user: null, session: null }, error: { message: 'No auth code found in callback URL' } }
    }

    const { data, error } = await call<{ user: AuthUser; session: AuthSession }>('/exchange', {
      body: { code },
    })
    if (error) return { data: { user: null, session: null }, error }
    save(data.session, 'SIGNED_IN')
    return { data: { user: data.user, session: data.session }, error: null }
  },

  async setSession(tokens: { access_token: string; refresh_token: string }) {
    const { data, error } = await call<{ session: AuthSession }>('/refresh', {
      body: { refresh_token: tokens.refresh_token },
    })
    if (error || !data?.session) {
      return { data: { user: null, session: null }, error: error || { message: 'Could not restore session' } }
    }
    save(data.session, 'SIGNED_IN')
    return { data: { user: data.session.user, session: data.session }, error: null }
  },

  async refreshSession() {
    const session = await refresh()
    if (!session) return { data: { user: null, session: null }, error: { message: 'Could not refresh session' } }
    return { data: { user: session.user, session }, error: null }
  },

  async signOut(): Promise<{ error: { message: string } | null }> {
    const session = load()
    if (session?.refresh_token) {
      await call('/logout', { body: { refresh_token: session.refresh_token } })
    }
    save(null, 'SIGNED_OUT')
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

    // A password change revokes every refresh token, this one included.
    if (attributes.password) {
      save(null, 'SIGNED_OUT')
    } else {
      save({ ...session, user: data.user }, 'USER_UPDATED')
    }
    return { data: { user: data.user }, error: null }
  },

  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    return call('/password/request', {
      body: { email, redirect_to: options?.redirectTo },
    })
  },

  /** Completes a reset started by resetPasswordForEmail. */
  async resetPassword(token: string, password: string) {
    return call('/password/reset', { body: { token, password } })
  },

  onAuthStateChange(callback: Listener) {
    listeners.add(callback)
    // Supabase fires an initial event; several screens rely on that to leave
    // their loading state.
    queueMicrotask(() => callback('INITIAL_SESSION', load()))
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    }
  },

  // Phone/SMS OTP was never wired to a provider — email verification goes
  // through the n8n webhooks in useAuth instead.
  async verifyOtp(_params: Record<string, any>) {
    return { data: { user: null, session: null }, error: { message: 'SMS OTP is not enabled' } }
  },

  async resend(_params: Record<string, any>) {
    return { data: null, error: { message: 'SMS OTP is not enabled' } }
  },
}

export const authClient = { auth }
