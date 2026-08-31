import { useEffect, useState, useCallback } from 'react'
import {
  Bell, BellOff, MapPin, AlertTriangle, MessageSquare, CheckCheck, Trash2, Circle,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { db } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import {
  C, TONE, FONT, Page, PageHeader, Card, Button, Skeleton,
  EmptyState, SummaryCard, IconTile,
} from '../components/crm'

type Notification = {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  created_at: string
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
] as const

type FilterKey = typeof FILTERS[number]['key']

function meta(type: string): { icon: LucideIcon; tone: string; label: string } {
  switch (type) {
    case 'device_found': return { icon: MapPin, tone: TONE.green, label: 'Device found' }
    case 'device_lost': return { icon: AlertTriangle, tone: TONE.red, label: 'Device lost' }
    case 'chat_message': return { icon: MessageSquare, tone: TONE.blue, label: 'Message' }
    case 'remote_lock': return { icon: AlertTriangle, tone: TONE.amber, label: 'Remote lock' }
    default: return { icon: Bell, tone: TONE.grey, label: 'Notification' }
  }
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function AlertsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setNotifications(data)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    await db.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const markAllAsRead = async () => {
    if (!user) return
    await db.from('notifications').update({ is_read: true }).eq('user_id', user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const deleteNotification = async (id: string) => {
    await db.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const unread = notifications.filter(n => !n.is_read).length
  const today = notifications.filter(n =>
    new Date(n.created_at).toDateString() === new Date().toDateString()).length

  const visible = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  return (
    <Page>
      <PageHeader
        title="Alerts"
        subtitle="Everything LOQIT has flagged on your account"
        actions={
          unread > 0
            ? <Button variant="ghost" icon={CheckCheck} onClick={markAllAsRead}>Mark all as read</Button>
            : undefined
        }
      />

      <div className="crm-c3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Total Alerts" value={notifications.length} icon={Bell} tone={TONE.blue} loading={loading} />
        <SummaryCard label="Unread" value={unread} icon={Circle} tone={unread ? TONE.amber : TONE.grey} loading={loading} note={unread ? 'needs review' : 'all caught up'} />
        <SummaryCard label="Today" value={today} icon={CheckCheck} tone={TONE.green} loading={loading} />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '4px', background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '999px', padding: '3px' }}>
            {FILTERS.map(f => {
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                    background: active ? C.card : 'transparent',
                    color: active ? C.primary : C.label,
                    border: `1px solid ${active ? C.tileBorder : 'transparent'}`,
                  }}
                >
                  {f.label}{f.key === 'unread' && unread > 0 ? ` (${unread})` : ''}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: '12px', color: C.muted, fontWeight: 500, marginLeft: 'auto' }}>
            {loading ? '—' : `${visible.length} shown`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width={34} height={34} radius={10} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="30%" height={13} />
                  <Skeleton width="55%" height={11} style={{ marginTop: '6px' }} />
                </div>
                <Skeleton width={54} height={11} />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={filter === 'unread' ? 'Nothing unread' : 'No alerts yet'}
            body={filter === 'unread'
              ? "You're all caught up."
              : 'When a device is reported lost, spotted by the mesh, or messaged about, it shows up here.'}
            action={filter === 'unread'
              ? <Button variant="ghost" onClick={() => setFilter('all')}>View all alerts</Button>
              : undefined}
          />
        ) : (
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {visible.map((n, i) => {
              const m = meta(n.type)
              return (
                <div
                  key={n.id}
                  className="crm-row"
                  onClick={() => !n.is_read && markAsRead(n.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '14px 20px',
                    borderBottom: i < visible.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: n.is_read ? 'default' : 'pointer',
                    background: n.is_read ? undefined : 'rgba(39,118,234,.03)',
                  }}
                >
                  <IconTile icon={m.icon} tone={m.tone} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: n.is_read ? 500 : 700, color: C.heading }}>
                        {n.title}
                      </span>
                      {!n.is_read && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.primary, flexShrink: 0 }} />
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: C.label, margin: '3px 0 0', lineHeight: 1.5 }}>{n.body}</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</span>
                    <button
                      title="Delete alert"
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id) }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', borderRadius: '9px',
                        background: C.card, border: `1px solid ${C.border}`,
                        color: C.muted, cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </Page>
  )
}
