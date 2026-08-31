import crypto from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from './db.js'
import { authMiddleware, clearRoleCache } from './auth.js'
import {
  buildSession, publicUser, rotateRefreshToken, signAccessToken,
  revokeRefreshToken, revokeAllForUser,
} from './tokens.js'

const router = Router()
const users = () => getDb().collection('users')

const fail = (res, code, message) => res.status(code).json({ data: null, error: { message } })
const ok = (res, data) => res.json({ data, error: null })

const normalizeEmail = (e) => String(e || '').trim().toLowerCase()
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const accessTtl = () => Number(process.env.ACCESS_TOKEN_TTL || 3600)

// ── email + password ────────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    const metadata = req.body?.data || {}

    if (!isEmail(email)) return fail(res, 400, 'Enter a valid email address')
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters')

    const existing = await users().findOne({ email })
    if (existing) return fail(res, 409, 'An account with this email already exists')

    const user = {
      id: crypto.randomUUID(),
      email,
      password_hash: await bcrypt.hash(password, 12),
      provider: 'email',
      google_sub: null,
      email_verified: false,
      user_metadata: metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await users().insertOne(user)

    const session = await buildSession(user)
    ok(res, { user: session.user, session })
  } catch (err) {
    fail(res, 500, err.message)
  }
})

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')

    const user = await users().findOne({ email })
    // Same message either way, so this cannot be used to enumerate accounts.
    if (!user?.password_hash) return fail(res, 400, 'Invalid login credentials')
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return fail(res, 400, 'Invalid login credentials')
    }

    const session = await buildSession(user)
    ok(res, { user: session.user, session })
  } catch (err) {
    fail(res, 500, err.message)
  }
})

// ── session lifecycle ───────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  try {
    const token = req.body?.refresh_token
    if (!token) return fail(res, 400, 'Missing refresh token')

    const rotated = await rotateRefreshToken(token)
    if (!rotated) return fail(res, 401, 'Refresh token is invalid or expired')

    const user = await users().findOne({ id: rotated.userId })
    if (!user) return fail(res, 401, 'User no longer exists')

    const access_token = await signAccessToken(user)
    ok(res, {
      user: publicUser(user),
      session: {
        access_token,
        refresh_token: rotated.refreshToken,
        token_type: 'bearer',
        expires_in: accessTtl(),
        expires_at: Math.floor(Date.now() / 1000) + accessTtl(),
        user: publicUser(user),
      },
    })
  } catch (err) {
    fail(res, 500, err.message)
  }
})

router.post('/logout', async (req, res) => {
  await revokeRefreshToken(req.body?.refresh_token)
  ok(res, {})
})

router.get('/user', authMiddleware, async (req, res) => {
  const user = await users().findOne({ id: req.user.id })
  if (!user) return fail(res, 404, 'User not found')
  ok(res, { user: publicUser(user) })
})

router.patch('/user', authMiddleware, async (req, res) => {
  try {
    const updates = { updated_at: new Date().toISOString() }
    const { password, email, data } = req.body || {}

    if (password) {
      if (String(password).length < 8) return fail(res, 400, 'Password must be at least 8 characters')
      updates.password_hash = await bcrypt.hash(String(password), 12)
    }
    if (email) {
      const next = normalizeEmail(email)
      if (!isEmail(next)) return fail(res, 400, 'Enter a valid email address')
      const clash = await users().findOne({ email: next, id: { $ne: req.user.id } })
      if (clash) return fail(res, 409, 'That email is already in use')
      updates.email = next
      updates.email_verified = false
    }
    if (data) updates.user_metadata = data

    await users().updateOne({ id: req.user.id }, { $set: updates })

    // Changing the password signs out every other device.
    if (password) await revokeAllForUser(req.user.id)

    clearRoleCache(req.user.id)
    const user = await users().findOne({ id: req.user.id })
    ok(res, { user: publicUser(user) })
  } catch (err) {
    fail(res, 500, err.message)
  }
})

// ── Google OAuth (server-side authorization code exchange) ──────────────────

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo'

function googleRedirectUri() {
  const base = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '')
  return `${base}/auth/google/callback`
}

// Short-lived state, so the callback knows where to send the user back to.
const pendingStates = new Map()
// One-time codes handed to the client, swapped for a session by /auth/exchange.
const pendingCodes = new Map()

function sweep(map) {
  const now = Date.now()
  for (const [k, v] of map) if (v.expires < now) map.delete(k)
}

router.get('/google/start', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return fail(res, 500, 'GOOGLE_CLIENT_ID is not configured')

  const state = crypto.randomBytes(16).toString('base64url')
  sweep(pendingStates)
  pendingStates.set(state, {
    redirectTo: String(req.query.redirect_to || process.env.DEFAULT_REDIRECT_TO || ''),
    expires: Date.now() + 10 * 60_000,
  })

  const url = new URL(GOOGLE_AUTH)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', googleRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')
  res.redirect(url.toString())
})

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query
    const pending = state ? pendingStates.get(String(state)) : null
    if (state) pendingStates.delete(String(state))

    const redirectTo = pending?.redirectTo || process.env.DEFAULT_REDIRECT_TO || ''
    const bounce = (params) => {
      if (!redirectTo) return fail(res, 400, 'No redirect target configured')
      const target = new URL(redirectTo)
      for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v)
      return res.redirect(target.toString())
    }

    if (error) return bounce({ error: String(error) })
    if (!code) return bounce({ error: 'missing_code' })
    if (!pending) return bounce({ error: 'invalid_state' })

    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      console.error('[auth/google] token exchange failed:', await tokenRes.text())
      return bounce({ error: 'google_token_exchange_failed' })
    }
    const tokens = await tokenRes.json()

    const infoRes = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!infoRes.ok) return bounce({ error: 'google_userinfo_failed' })
    const info = await infoRes.json()

    const email = normalizeEmail(info.email)
    if (!email) return bounce({ error: 'google_no_email' })

    // Link by google_sub first, then by email, so an existing email account can
    // also sign in with Google.
    let user = await users().findOne({ $or: [{ google_sub: info.sub }, { email }] })
    if (user) {
      await users().updateOne({ id: user.id }, {
        $set: {
          google_sub: info.sub,
          email_verified: true,
          user_metadata: {
            ...(user.user_metadata || {}),
            full_name: user.user_metadata?.full_name || info.name || '',
            avatar_url: info.picture || user.user_metadata?.avatar_url || null,
          },
          updated_at: new Date().toISOString(),
        },
      })
      user = await users().findOne({ id: user.id })
    } else {
      user = {
        id: crypto.randomUUID(),
        email,
        password_hash: null,
        provider: 'google',
        google_sub: info.sub,
        email_verified: true,
        user_metadata: {
          full_name: info.name || '',
          avatar_url: info.picture || null,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await users().insertOne(user)
    }

    // Hand back a one-time code rather than tokens in the URL — a URL leaks
    // through history, server logs and referrer headers.
    const oneTime = crypto.randomBytes(32).toString('base64url')
    sweep(pendingCodes)
    pendingCodes.set(oneTime, { userId: user.id, expires: Date.now() + 2 * 60_000 })
    return bounce({ code: oneTime })
  } catch (err) {
    console.error('[auth/google/callback]', err)
    return fail(res, 500, err.message)
  }
})

router.post('/exchange', async (req, res) => {
  try {
    const code = String(req.body?.code || '')
    sweep(pendingCodes)
    const pending = pendingCodes.get(code)
    if (!pending) return fail(res, 400, 'Invalid or expired code')
    pendingCodes.delete(code)

    const user = await users().findOne({ id: pending.userId })
    if (!user) return fail(res, 400, 'User not found')

    const session = await buildSession(user)
    ok(res, { user: session.user, session })
  } catch (err) {
    fail(res, 500, err.message)
  }
})

// ── password reset ──────────────────────────────────────────────────────────

const resetTokens = new Map()

router.post('/password/request', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const user = await users().findOne({ email })

  if (user?.password_hash) {
    const token = crypto.randomBytes(32).toString('base64url')
    sweep(resetTokens)
    resetTokens.set(token, { userId: user.id, expires: Date.now() + 30 * 60_000 })

    const base = String(req.body?.redirect_to || process.env.DEFAULT_RESET_REDIRECT || process.env.DEFAULT_REDIRECT_TO || '')
    const link = `${base}?reset_token=${token}`
    const hook = process.env.N8N_RESET_EMAIL_URL
    if (hook) {
      try {
        await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, link }),
        })
      } catch (err) {
        console.warn('[auth/password/request] email hook failed:', err.message)
      }
    } else {
      console.log(`[auth] password reset link for ${email}: ${link}`)
    }
  }

  // Always the same response — never reveal whether an address is registered.
  ok(res, {})
})

router.post('/password/reset', async (req, res) => {
  try {
    const token = String(req.body?.token || '')
    const password = String(req.body?.password || '')
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters')

    sweep(resetTokens)
    const pending = resetTokens.get(token)
    if (!pending) return fail(res, 400, 'This reset link is invalid or has expired')
    resetTokens.delete(token)

    await users().updateOne({ id: pending.userId }, {
      $set: { password_hash: await bcrypt.hash(password, 12), updated_at: new Date().toISOString() },
    })
    await revokeAllForUser(pending.userId)
    ok(res, {})
  } catch (err) {
    fail(res, 500, err.message)
  }
})

export default router
