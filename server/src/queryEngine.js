import { randomUUID } from 'node:crypto'
import { getDb } from './db.js'
import { getRule, isPolice } from './rules.js'

// Known embedded relations, mirroring the PostgREST embeds the apps use,
// e.g. select('*, beacon_logs(id, latitude, ...)') on devices.
const RELATIONS = {
  devices: { beacon_logs: { kind: 'many', foreignKey: 'device_id' } },
  chat_rooms: {
    chat_messages: { kind: 'many', foreignKey: 'room_id' },
    devices: { kind: 'one', localKey: 'device_id' },
    profiles: { kind: 'one', localKey: 'owner_id' },
  },
  chat_messages: { profiles: { kind: 'one', localKey: 'sender_id' } },
  lost_reports: {
    devices: { kind: 'one', localKey: 'device_id' },
    profiles: { kind: 'one', localKey: 'owner_id' },
  },
  notifications: { devices: { kind: 'one', localKey: 'device_id' } },
  anti_theft_events: { devices: { kind: 'one', localKey: 'device_id' } },
  protection_settings: { devices: { kind: 'one', localKey: 'device_id' } },
}

// Parse a PostgREST select string into { fields, embeds }.
// "id, status, beacon_logs(id, latitude)" -> fields:[id,status], embeds:[{table, columns}]
function parseSelect(select) {
  const embeds = []
  let fields = []
  if (!select || select.trim() === '' ) return { fields: ['*'], embeds }
  let rest = select
  const embedRe = /([a-zA-Z_]+)\s*\(([^)]*)\)/g
  rest = rest.replace(embedRe, (_, table, cols) => {
    embeds.push({ table, columns: cols.split(',').map((c) => c.trim()).filter(Boolean) })
    return ''
  })
  fields = rest.split(',').map((f) => f.trim()).filter(Boolean)
  if (fields.length === 0) fields = ['*']
  return { fields, embeds }
}

// Parse a PostgREST .or() expression: "col.eq.v,col2.in.(a,b),col3.ilike.%x%"
function parseOrExpr(expr) {
  const branches = []
  for (const part of String(expr).split(/,(?![^(]*\))/)) {
    const m = part.match(/^(\w+)\.(eq|neq|in|ilike|like|is|gt|gte|lt|lte)\.(.*)$/)
    if (!m) continue
    const [, col, op, rawVal] = m
    let val = rawVal
    if (op === 'in') {
      const items = rawVal.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim())
      branches.push({ [col]: { $in: items } })
      continue
    }
    if (op === 'is' && val === 'null') val = null
    const cond = {
      eq: val,
      neq: { $ne: val },
      is: val,
      gt: { $gt: val },
      gte: { $gte: val },
      lt: { $lt: val },
      lte: { $lte: val },
      like: { $regex: String(val).replace(/%/g, '.*') },
      ilike: { $regex: String(val).replace(/%/g, '.*'), $options: 'i' },
    }[op]
    branches.push({ [col]: cond })
  }
  return branches.length ? { $or: branches } : {}
}

function filtersToMongo(filters = []) {
  const out = {}
  const ands = []
  for (const f of filters) {
    if (f.type === 'or') {
      ands.push(parseOrExpr(f.value))
      continue
    }
    if (f.type === 'not') {
      // only the ".not(col, 'is', null)" shape is used by the apps
      const { op, value } = f.value || {}
      if (op === 'is' && value === null) {
        out[f.column] = { $ne: null }
      } else {
        throw new Error(`Unsupported not() operator: ${op}`)
      }
      continue
    }
    const col = f.column
    const map = {
      eq: (v) => v,
      neq: (v) => ({ $ne: v }),
      in: (v) => ({ $in: v }),
      gt: (v) => ({ $gt: v }),
      gte: (v) => ({ $gte: v }),
      lt: (v) => ({ $lt: v }),
      lte: (v) => ({ $lte: v }),
      is: (v) => v, // .is('col', null)
      like: (v) => ({ $regex: String(v).replace(/%/g, '.*'), $options: '' }),
      ilike: (v) => ({ $regex: String(v).replace(/%/g, '.*'), $options: 'i' }),
    }
    const fn = map[f.type]
    if (!fn) throw new Error(`Unsupported filter: ${f.type}`)
    const cond = fn(f.value)
    if (out[col] && typeof out[col] === 'object' && typeof cond === 'object') {
      Object.assign(out[col], cond)
    } else {
      out[col] = cond
    }
  }
  if (ands.length) return { $and: [out, ...ands] }
  return out
}

function project(doc, fields) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  if (fields.includes('*')) return rest
  const out = {}
  for (const f of fields) if (f in rest) out[f] = rest[f]
  return out
}

async function attachEmbeds(table, docs, embeds) {
  for (const embed of embeds) {
    const rel = RELATIONS[table]?.[embed.table]
    if (!rel) continue
    const coll = getDb().collection(embed.table)
    const cols = embed.columns.length && !embed.columns.includes('*') ? embed.columns : null
    if (rel.kind === 'many') {
      const ids = docs.map((d) => d.id)
      const children = await coll.find({ [rel.foreignKey]: { $in: ids } }).toArray()
      for (const d of docs) {
        d[embed.table] = children
          .filter((c) => c[rel.foreignKey] === d.id)
          .map((c) => project(c, cols || ['*']))
      }
    } else {
      const ids = [...new Set(docs.map((d) => d[rel.localKey]).filter(Boolean))]
      const parents = await coll.find({ id: { $in: ids } }).toArray()
      const byId = new Map(parents.map((p) => [p.id, p]))
      for (const d of docs) {
        const p = byId.get(d[rel.localKey])
        d[embed.table] = p ? project(p, cols || ['*']) : null
      }
    }
  }
  return docs
}

// Civilian chat_messages reads are restricted to rooms they own.
async function chatMessageScope(user) {
  if (isPolice(user)) return null
  const rooms = await getDb().collection('chat_rooms').find({ owner_id: user.id }).project({ id: 1 }).toArray()
  return { $or: [{ room_id: { $in: rooms.map((r) => r.id) } }, { sender_id: user.id }] }
}

export async function runQuery(user, q) {
  const { table, op } = q
  const rule = getRule(table)
  if (!rule) return { error: { message: `Unknown table: ${table}` } }

  const coll = getDb().collection(table)
  const { fields, embeds } = parseSelect(q.select)
  const userFilter = filtersToMongo(q.filters)

  const scopes = []
  if (op === 'select' || op === 'count') {
    const rf = rule.readFilter(user)
    if (rf === false) return { error: { message: 'Not authorized' } }
    if (rf) scopes.push(rf)
    if (table === 'chat_messages') {
      const cs = await chatMessageScope(user)
      if (cs) scopes.push(cs)
    }
  } else if (op === 'update' || op === 'delete') {
    const wf = rule.writeFilter(user)
    if (wf === false) return { error: { message: 'Not authorized' } }
    if (wf) scopes.push(wf)
  }
  const filter = scopes.length ? { $and: [userFilter, ...scopes] } : userFilter

  switch (op) {
    case 'select': {
      if (q.head && q.count) {
        const count = await coll.countDocuments(filter)
        return { data: null, count, error: null }
      }
      let cursor = coll.find(filter)
      if (q.order) cursor = cursor.sort({ [q.order.column]: q.order.ascending ? 1 : -1 })
      if (q.limit) cursor = cursor.limit(q.limit)
      let docs = await cursor.toArray()
      docs = docs.map((d) => project(d, embeds.length ? ['*'] : fields))
      if (embeds.length) {
        docs = await attachEmbeds(table, docs, embeds)
        if (!fields.includes('*')) docs = docs.map((d) => {
          const keep = [...fields, ...embeds.map((e) => e.table)]
          return Object.fromEntries(Object.entries(d).filter(([k]) => keep.includes(k)))
        })
      }
      const count = q.count === 'exact' ? await coll.countDocuments(filter) : undefined
      if (q.single) {
        if (docs.length === 0) {
          return q.single === 'single'
            ? { data: null, error: { message: 'Row not found' } }
            : { data: null, error: null, count }
        }
        return { data: docs[0], error: null, count }
      }
      return { data: docs, error: null, count }
    }

    case 'insert': {
      const values = Array.isArray(q.values) ? q.values : [q.values]
      const now = new Date().toISOString()
      const docs = values.map((v) => {
        const id = v.id || randomUUID()
        return { _id: id, id, created_at: v.created_at || now, updated_at: v.updated_at || now, ...v }
      })
      for (const d of docs) {
        if (!rule.insertCheck(user, d)) return { error: { message: 'Not authorized to insert' } }
      }
      if (q.onConflict) {
        for (const d of docs) {
          const conflictFilter = { [q.onConflict]: d[q.onConflict] }
          if (q.ignoreDuplicates) {
            await coll.updateOne(conflictFilter, { $setOnInsert: d }, { upsert: true })
          } else {
            const { _id, ...rest } = d
            await coll.updateOne(conflictFilter, { $set: rest, $setOnInsert: { _id } }, { upsert: true })
          }
        }
      } else {
        await coll.insertMany(docs)
      }
      const data = docs.map(({ _id, ...rest }) => rest)
      return { data: q.single ? data[0] : data, error: null, inserted: data }
    }

    case 'update': {
      const values = { ...q.values, updated_at: new Date().toISOString() }
      delete values._id
      delete values.id
      const before = await coll.find(filter).limit(200).toArray()
      await coll.updateMany(filter, { $set: values })
      const after = await coll.find({ id: { $in: before.map((d) => d.id) } }).toArray()
      const data = after.map(({ _id, ...rest }) => rest)
      return { data: q.single ? data[0] ?? null : data, error: null, updated: data }
    }

    case 'delete': {
      const before = await coll.find(filter).limit(200).toArray()
      await coll.deleteMany(filter)
      const data = before.map(({ _id, ...rest }) => rest)
      return { data, error: null, deleted: data }
    }

    case 'count': {
      const count = await coll.countDocuments(filter)
      return { data: null, count, error: null }
    }

    default:
      return { error: { message: `Unsupported op: ${op}` } }
  }
}
