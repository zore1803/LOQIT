import { getDb } from './db.js'
import { verifyAccessToken } from './tokens.js'

// Auth is issued and verified by this server (see authRoutes.js). Clients send
// the access token we minted; there is no external identity provider in the
// request path any more.
export async function verifyToken(token) {
  return verifyAccessToken(token)
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
    // First authenticated call for a newly created account — provision the
    // profile row the rest of the app expects.
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

export function clearRoleCache(userId) {
  roleCache.delete(userId)
}

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: { message: 'Missing bearer token' } })
    const payload = await verifyToken(token)
    req.user = await resolveUser(payload)
    next()
  } catch (err) {
    res.status(401).json({ error: { message: `Invalid token: ${err.message}` } })
  }
}
