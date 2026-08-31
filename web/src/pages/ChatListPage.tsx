import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, MessagesSquare, Smartphone, ChevronRight, RefreshCw } from 'lucide-react'
import { db } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import {
  C, TONE, Page, PageHeader, Card, Button, Badge, Skeleton,
  EmptyState, ErrorState, SummaryCard, IconTile,
} from '../components/crm'

type RoomRecord = {
  id: string
  owner_id: string
  device_id: string
  is_active: boolean
  created_at: string
  devices: {
    make: string
    model: string
    imei_primary: string
    status: string
  } | null
}

type RoomItem = {
  id: string
  deviceId: string
  isActive: boolean
  createdAt: string
  ownerId: string
  role: 'owner' | 'finder'
  make: string
  model: string
  imeiTail: string
  status: string
  lastMessage: string
  lastSentAt: string
  unreadCount: number
}

function getRelativeTime(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function ChatListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    if (!user?.id) {
      setRooms([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch rooms where user is owner
      const { data: ownerRooms, error: ownerError } = await db
        .from('chat_rooms')
        .select('id, owner_id, device_id, is_active, created_at, devices(make, model, imei_primary, status)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (ownerError) throw ownerError

      const roomItems: RoomItem[] = []

      for (const room of (ownerRooms || []) as unknown as RoomRecord[]) {
        const device = room.devices
        
        // Fetch last message
        const { data: lastMsg } = await db
          .from('chat_messages')
          .select('content, sent_at')
          .eq('room_id', room.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single()

        // Fetch unread count
        const { count } = await db
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .eq('is_read', false)
          .neq('sender_role', 'owner')

        roomItems.push({
          id: room.id,
          deviceId: room.device_id,
          isActive: room.is_active,
          createdAt: room.created_at,
          ownerId: room.owner_id,
          role: 'owner',
          make: device?.make || 'Unknown',
          model: device?.model || 'Device',
          imeiTail: device?.imei_primary?.slice(-4) || '----',
          status: device?.status || 'unknown',
          lastMessage: lastMsg?.content || 'No messages yet',
          lastSentAt: lastMsg?.sent_at || room.created_at,
          unreadCount: count || 0,
        })
      }

      setRooms(roomItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchRooms()

    // Subscribe to new messages for real-time unread count updates
    const channel = db
      .channel('chat_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        () => {
          // Refetch rooms when any message changes
          fetchRooms()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms',
        },
        () => {
          // Refetch when room status changes
          fetchRooms()
        }
      )
      .subscribe()



    return () => {
      db.removeChannel(channel)
    }
  }, [fetchRooms])

  const totalUnread = rooms.reduce((sum, r) => sum + r.unreadCount, 0)
  const activeRooms = rooms.filter(r => r.isActive).length

  return (
    <Page>
      <PageHeader
        title="Messages"
        subtitle="Anonymous conversations between you and whoever finds your device"
        actions={<Button variant="ghost" icon={RefreshCw} onClick={() => fetchRooms()}>Refresh</Button>}
      />

      <div className="crm-c3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Conversations" value={rooms.length} icon={MessagesSquare} tone={TONE.blue} loading={loading} />
        <SummaryCard label="Active" value={activeRooms} icon={MessageSquare} tone={TONE.green} loading={loading} />
        <SummaryCard label="Unread Messages" value={totalUnread} icon={MessageSquare} tone={totalUnread ? TONE.amber : TONE.grey} loading={loading} note={totalUnread ? 'awaiting reply' : 'all caught up'} />
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width={38} height={38} radius={10} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="32%" height={13} />
                  <Skeleton width="58%" height={11} style={{ marginTop: '6px' }} />
                </div>
                <Skeleton width={40} height={11} />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchRooms()} />
        ) : rooms.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            body="When someone finds one of your devices, a private chat opens here. Neither side ever sees the other's phone number."
          />
        ) : (
          <div>
            {rooms.map((room, i) => (
              <div
                key={room.id}
                className="crm-row"
                onClick={() => navigate(`/chat/${room.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 20px', cursor: 'pointer',
                  borderBottom: i < rooms.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: room.unreadCount > 0 ? 'rgba(39,118,234,.03)' : undefined,
                }}
              >
                <IconTile icon={Smartphone} size={38} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>
                      {room.make} {room.model}
                    </span>
                    <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'ui-monospace, monospace' }}>
                      ····{room.imeiTail}
                    </span>
                    {!room.isActive && <Badge tone={TONE.grey}>Closed</Badge>}
                    {room.status === 'lost' && <Badge tone={TONE.red}>Lost</Badge>}
                  </div>
                  <p style={{
                    fontSize: '12px', margin: '3px 0 0',
                    color: room.unreadCount > 0 ? C.heading : C.muted,
                    fontWeight: room.unreadCount > 0 ? 500 : 400,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {room.lastMessage}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>
                    {getRelativeTime(room.lastSentAt)}
                  </span>
                  {room.unreadCount > 0 && (
                    <span style={{
                      minWidth: '20px', height: '20px', padding: '0 6px',
                      borderRadius: '999px', background: C.primary, color: '#fff',
                      fontSize: '11px', fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {room.unreadCount > 99 ? '99+' : room.unreadCount}
                    </span>
                  )}
                  <ChevronRight size={15} color={C.muted} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  )
}
