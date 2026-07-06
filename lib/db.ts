/**
 * MongoDB data client. Drop-in replacement for the parts of the Supabase
 * client the app used for DATA (`.from()`, `.channel()`, `.rpc()`).
 * Auth stays on Supabase — this client sends the Supabase access token to
 * the LOQIT API (server/), which verifies it and enforces per-user scoping.
 *
 * Usage is call-compatible with the old code:
 *   db.from('devices').select('*').eq('owner_id', id).order(...).limit(...)
 *   db.channel('x').on('postgres_changes', { table: 'devices' }, cb).subscribe()
 */
import { io, Socket } from 'socket.io-client'
import { supabase } from './supabase'

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000').replace(/\/$/, '')

type Filter = { type: string; column: string; value: unknown }
type QueryResult<T = any> = { data: T; error: { message: string } | null; count?: number }

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function post(path: string, body: unknown): Promise<QueryResult> {
  const token = await getToken()
  if (!token) return { data: null, error: { message: 'Not signed in' } }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    return (await res.json()) as QueryResult
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error' } }
  }
}

class QueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private q: any

  constructor(table: string) {
    this.q = { table, op: 'select', select: '*', filters: [] }
  }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (this.q.op === 'select') {
      this.q.select = columns
      if (opts?.count) this.q.count = opts.count
      if (opts?.head) this.q.head = true
    }
    // after insert/update: "returning" — server already returns the rows
    return this
  }

  insert(values: unknown) { this.q.op = 'insert'; this.q.values = values; return this }
  update(values: unknown) { this.q.op = 'update'; this.q.values = values; return this }
  upsert(values: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.q.op = 'insert'
    this.q.values = values
    this.q.onConflict = opts?.onConflict || 'id'
    this.q.ignoreDuplicates = opts?.ignoreDuplicates ?? false
    return this
  }
  delete() { this.q.op = 'delete'; return this }

  private f(type: string, column: string, value: unknown) {
    this.q.filters.push({ type, column, value } satisfies Filter)
    return this
  }
  eq(c: string, v: unknown) { return this.f('eq', c, v) }
  neq(c: string, v: unknown) { return this.f('neq', c, v) }
  in(c: string, v: unknown[]) { return this.f('in', c, v) }
  gt(c: string, v: unknown) { return this.f('gt', c, v) }
  gte(c: string, v: unknown) { return this.f('gte', c, v) }
  lt(c: string, v: unknown) { return this.f('lt', c, v) }
  lte(c: string, v: unknown) { return this.f('lte', c, v) }
  is(c: string, v: unknown) { return this.f('is', c, v) }
  like(c: string, v: string) { return this.f('like', c, v) }
  ilike(c: string, v: string) { return this.f('ilike', c, v) }
  not(c: string, op: string, v: unknown) { return this.f('not', c, { op, value: v }) }
  or(expr: string) { return this.f('or', '', expr) }

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.q.order = { column, ascending: opts?.ascending ?? true }
    return this
  }
  limit(n: number) { this.q.limit = n; return this }
  single() { this.q.single = 'single'; return this }
  maybeSingle() { this.q.single = 'maybeSingle'; return this }

  then<R1 = QueryResult<T>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return post('/api/db', this.q).then(onfulfilled as any, onrejected as any)
  }
}

// ----- realtime (Socket.io replaces Supabase postgres_changes) -----

let socket: Socket | null = null

async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket
  if (!socket) {
    const token = await getToken()
    socket = io(API_URL, { auth: { token }, transports: ['websocket'] })
    supabase.auth.onAuthStateChange(async (_e, session) => {
      if (socket) {
        ;(socket.auth as any).token = session?.access_token
        if (!socket.connected) socket.connect()
      }
    })
  }
  return socket
}

type ChangeHandler = { table: string; event: string; filter?: string; cb: (payload: any) => void }

class Channel {
  private handlers: ChangeHandler[] = []
  private bound: Array<{ event: string; fn: (p: any) => void }> = []

  on(_type: 'postgres_changes', spec: { event?: string; schema?: string; table: string; filter?: string }, cb: (payload: any) => void) {
    this.handlers.push({ table: spec.table, event: spec.event || '*', filter: spec.filter, cb })
    return this
  }

  subscribe(onStatus?: (status: string) => void) {
    void (async () => {
      const s = await getSocket()
      for (const h of this.handlers) {
        const fn = (payload: any) => {
          if (h.event !== '*' && payload.eventType !== h.event) return
          if (h.filter) {
            // supports "col=eq.value" — the only shape the app uses
            const m = h.filter.match(/^(\w+)=eq\.(.+)$/)
            if (m && String(payload.new?.[m[1]] ?? payload.old?.[m[1]]) !== m[2]) return
          }
          h.cb(payload)
        }
        s.on(`change:${h.table}`, fn)
        this.bound.push({ event: `change:${h.table}`, fn })
      }
      onStatus?.('SUBSCRIBED')
    })()
    return this
  }

  unsubscribe() {
    if (socket) for (const b of this.bound) socket.off(b.event, b.fn)
    this.bound = []
  }
}

export const db = {
  from<T = any>(table: string) { return new QueryBuilder<T>(table) },
  rpc(name: string, params?: Record<string, unknown>) { return post(`/api/rpc/${name}`, params || {}) },
  channel(_name: string) { return new Channel() },
  removeChannel(ch: Channel) { ch.unsubscribe() },
}
