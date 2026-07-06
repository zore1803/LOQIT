import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getDb } from './db.js'

// Auth stays on Supabase: clients send the Supabase access token and we verify
// it here. Supports both the legacy HS256 shared secret and the newer
// asymmetric keys published at the project's JWKS endpoint.
const jwtSecret = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null

let jwks = null
function getJwks() {
  if (!jwks) {
    const base = process.env.SUPABASE_URL?.replace(/\/$/, '')
    if (!base) throw new Error('SUPABASE_URL is not set')
    jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`))
  }
  return jwks
}

export async function verifySupabaseToken(token) {
  const options = { audience: 'authenticated' }
  if (jwtSecret) {
    const { payload } = await jwtVerify(token, jwtSecret, options)
    return payload
  }
  const { payload } = await jwtVerify(token, getJwks(), options)
  return payload
}

// role cache: userId -> { role, expires }
const roleCache = new Map()

export async function resolveUser(payload) {
  const userId = payload.sub
  const cached = roleCache.get(userId)
  if (cached && cached.expires > Date.now()) {
    return { id: userId, email: payload.email, role: cached.role }
  }

  const profiles = getDb().collection('profiles')
  let profile = await profiles.findOne({ id: userId })

  if (!profile) {
    // First request from a user that signed up after the migration (e.g. a new
    // Google account). Supabase used a DB trigger to create the profile row;
    // here we provision it on first authenticated call.
    const meta = payload.user_metadata || {}
    profile = {
      _id: userId,
      id: userId,
      full_name: meta.full_name || meta.name || '',
      phone_number: meta.phone_number || null,
      aadhaar_hash: null,
      aadhaar_verified: false,
      email_verified: !!payload.email && payload.app_metadata?.provider === 'google',
      role: 'civilian',
      avatar_url: meta.avatar_url || null,
      email: payload.email || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await profiles.updateOne({ id: userId }, { $setOnInsert: profile }, { upsert: true })
  }

  roleCache.set(userId, { role: profile.role, expires: Date.now() + 60_000 })
  return { id: userId, email: payload.email, role: profile.role }
}

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: { message: 'Missing bearer token' } })
    const payload = await verifySupabaseToken(token)
    req.user = await resolveUser(payload)
    next()
  } catch (err) {
    res.status(401).json({ error: { message: `Invalid token: ${err.message}` } })
  }
}
