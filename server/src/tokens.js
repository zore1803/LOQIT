import crypto from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { getDb } from './db.js'

const ACCESS_TTL_SEC = Number(process.env.ACCESS_TOKEN_TTL || 3600)        // 1h
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TOKEN_TTL || 2592000)   // 30d

function secret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET is not set (needs at least 32 characters)')
  }
  return new TextEncoder().encode(s)
}

/** Access token — short-lived, stateless, verified on every API call. */
export async function signAccessToken(user) {
  return new SignJWT({
    email: user.email,
    role: user.role || 'civilian',
    user_metadata: user.user_metadata || {},
    app_metadata: { provider: user.provider || 'email' },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret())
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, secret(), { audience: 'authenticated' })
  return payload
}

/**
 * Refresh tokens are opaque random strings. Only their SHA-256 hash is stored,
 * so a database leak cannot be replayed as a login.
 */
function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('base64url')
  await getDb().collection('refresh_tokens').insertOne({
    token_hash: hash(token),
    user_id: userId,
    created_at: new Date(),
    expires_at: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
  })
  return token
}

/** Consumes the old token and issues a new one (rotation). */
export async function rotateRefreshToken(token) {
  const col = getDb().collection('refresh_tokens')
  const row = await col.findOneAndDelete({ token_hash: hash(token) })
  const doc = row?.value ?? row
  if (!doc || new Date(doc.expires_at) < new Date()) return null
  return { userId: doc.user_id, refreshToken: await issueRefreshToken(doc.user_id) }
}

export async function revokeRefreshToken(token) {
  if (!token) return
  await getDb().collection('refresh_tokens').deleteOne({ token_hash: hash(token) })
}

export async function revokeAllForUser(userId) {
  await getDb().collection('refresh_tokens').deleteMany({ user_id: userId })
}

/** Shaped like a Supabase session so the client shim can pass it straight through. */
export async function buildSession(user) {
  const access_token = await signAccessToken(user)
  const refresh_token = await issueRefreshToken(user.id)
  return {
    access_token,
    refresh_token,
    token_type: 'bearer',
    expires_in: ACCESS_TTL_SEC,
    expires_at: Math.floor(Date.now() / 1000) + ACCESS_TTL_SEC,
    user: publicUser(user),
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    email_confirmed_at: user.email_verified ? user.updated_at : null,
    user_metadata: user.user_metadata || {},
    app_metadata: { provider: user.provider || 'email' },
    created_at: user.created_at,
  }
}
