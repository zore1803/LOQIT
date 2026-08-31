import { Server } from 'socket.io'
import { verifyToken, resolveUser } from './auth.js'
import { isPolice } from './rules.js'
import { getDb } from './db.js'

let io

export function initRealtime(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next(new Error('missing token'))
      const payload = await verifyToken(token)
      socket.data.user = await resolveUser(payload)
      next()
    } catch (err) {
      next(new Error(`unauthorized: ${err.message}`))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    socket.join(`user:${user.id}`)
    if (isPolice(user)) socket.join('police')
    // Device-status changes are broadcast to everyone: the lost-device
    // monitor on every phone listens for other people's lost devices.
    socket.join('devices')
  })

  return io
}

// Route a write event to the sockets that are allowed to see it — the
// replacement for Supabase realtime "postgres_changes".
export async function emitChange(table, eventType, rows, oldRows = []) {
  if (!io || !rows?.length) return
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const payload = { table, eventType, new: row, old: oldRows[i] || null }

    switch (table) {
      case 'devices':
        io.to('devices').emit(`change:${table}`, payload)
        break
      case 'notifications':
        if (row.user_id) io.to(`user:${row.user_id}`).emit(`change:${table}`, payload)
        io.to('police').emit(`change:${table}`, payload)
        break
      case 'chat_messages': {
        try {
          const room = await getDb().collection('chat_rooms').findOne({ id: row.room_id })
          if (room?.owner_id) io.to(`user:${room.owner_id}`).emit(`change:${table}`, payload)
        } catch { /* room lookup best-effort */ }
        io.to('police').emit(`change:${table}`, payload)
        break
      }
      case 'beacon_logs':
      case 'anti_theft_events':
      case 'lost_reports':
      case 'chat_rooms': {
        if (row.owner_id) io.to(`user:${row.owner_id}`).emit(`change:${table}`, payload)
        io.to('police').emit(`change:${table}`, payload)
        // beacon logs matter to the device owner, not the reporter
        if (table === 'beacon_logs' && row.device_id) {
          try {
            const device = await getDb().collection('devices').findOne({ id: row.device_id })
            if (device?.owner_id) io.to(`user:${device.owner_id}`).emit(`change:${table}`, payload)
          } catch { /* best-effort */ }
        }
        break
      }
      default:
        if (row.owner_id || row.user_id) {
          io.to(`user:${row.owner_id || row.user_id}`).emit(`change:${table}`, payload)
        }
        io.to('police').emit(`change:${table}`, payload)
    }
  }
}
