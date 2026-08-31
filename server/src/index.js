import 'dotenv/config'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { connectMongo, getDb } from './db.js'
import { authMiddleware } from './auth.js'
import authRoutes from './authRoutes.js'
import { runQuery } from './queryEngine.js'
import { initRealtime, emitChange } from './realtime.js'
import { generateDeviceKey } from './deviceKey.js'

const app = express()
const corsOrigins = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim())
app.use(cors({ origin: corsOrigins.includes('*') ? true : corsOrigins }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ ok: true }))

// Authentication is issued by this server (email/password + Google OAuth).
app.use('/auth', authRoutes)

// Generic data endpoint — the client-side `db.from(...)` shim posts here.
app.post('/api/db', authMiddleware, async (req, res) => {
  try {
    const q = req.body

    // Devices get their LOQIT key at insert time (replaces the old
    // generate-device-key Supabase edge function + webhook).
    if (q.table === 'devices' && q.op === 'insert') {
      const values = Array.isArray(q.values) ? q.values : [q.values]
      for (const v of values) {
        if (!v.loqit_key && v.state && v.imei_primary && v.serial_number) {
          try {
            Object.assign(v, generateDeviceKey(v))
          } catch (err) {
            console.warn('[deviceKey] generation skipped:', err.message)
          }
        }
      }
    }

    const result = await runQuery(req.user, q)
    if (!result.error) {
      const changed = result.inserted || result.updated || result.deleted
      if (changed?.length) {
        const eventType = result.inserted ? 'INSERT' : result.updated ? 'UPDATE' : 'DELETE'
        void emitChange(q.table, eventType, changed)
      }
    }
    const { inserted, updated, deleted, ...response } = result
    res.json({ data: null, error: null, ...response })
  } catch (err) {
    console.error('[api/db] error:', err)
    res.json({ data: null, error: { message: err.message } })
  }
})

// RPC endpoints (replacing Postgres functions)
app.post('/api/rpc/verify_serial', authMiddleware, async (req, res) => {
  try {
    const serial = String(req.body?.p_serial || '').trim()
    if (!serial) return res.json({ data: { registered: false }, error: null })
    const device = await getDb().collection('devices').findOne({ serial_number: serial })
    if (!device) return res.json({ data: { registered: false }, error: null })
    const owner = await getDb().collection('profiles').findOne({ id: device.owner_id })
    const name = owner?.full_name || ''
    const owner_masked = name
      ? `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 3))}`
      : undefined
    res.json({
      data: {
        registered: true,
        status: device.status,
        make: device.make,
        model: device.model,
        owner_masked,
      },
      error: null,
    })
  } catch (err) {
    res.json({ data: null, error: { message: err.message } })
  }
})

const port = Number(process.env.PORT || 4000)
const server = http.createServer(app)

connectMongo()
  .then(() => {
    initRealtime(server, corsOrigins.includes('*') ? true : corsOrigins)
    server.listen(port, () => console.log(`[loqit-api] listening on :${port}`))
  })
  .catch((err) => {
    console.error('Failed to start:', err)
    process.exit(1)
  })
