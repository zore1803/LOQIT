import { CSSProperties, useEffect, useState, useCallback } from 'react'
import { Colors } from '../lib/colors'
import { db } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/Card'
import { Button } from '../components/Button'

type Notification = {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  created_at: string
}

export function AlertsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setNotifications(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    await db.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const markAllAsRead = async () => {
    if (!user) return
    await db.from('notifications').update({ is_read: true }).eq('user_id', user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const deleteNotification = async (id: string) => {
    await db.from('notifications').delete().eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'device_found':
        return { icon: 'location_on', color: Colors.secondary }
      case 'device_lost':
        return { icon: 'warning', color: Colors.error }
      case 'chat_message':
        return { icon: 'chat', color: Colors.primary }
      default:
        return { icon: 'notifications', color: Colors.tertiary }
    }
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const containerStyle: CSSProperties = {
    padding: '40px',
    maxWidth: '1000px',
    margin: '0 auto',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    background: `linear-gradient(135deg, ${Colors.tertiary}10 0%, transparent 100%)`,
    padding: '28px 32px',
    borderRadius: '20px',
    border: `1px solid ${Colors.tertiary}20`,
  }

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    color: Colors.onSurface,
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const notificationStyle = (isRead: boolean): CSSProperties => ({
    display: 'flex',
    gap: '20px',
    padding: '24px',
    backgroundColor: isRead ? Colors.surfaceContainerLow : Colors.surfaceContainer,
    borderRadius: '16px',
    marginBottom: '16px',
    opacity: isRead ? 0.7 : 1,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    border: `1px solid ${isRead ? Colors.outlineVariant : Colors.primary}30`,
    boxShadow: isRead ? 'none' : `0 2px 8px ${Colors.primary}10`,
  })

  const emptyStyle: CSSProperties = {
    textAlign: 'center',
    padding: '80px 40px',
    color: Colors.onSurfaceVariant,
    background: `linear-gradient(135deg, ${Colors.tertiary}08 0%, transparent 100%)`,
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '100px', color: Colors.onSurfaceVariant }}>
          <span className="material-icons" style={{ fontSize: '48px', animation: 'spin 1s linear infinite', marginBottom: '16px', display: 'block' }}>
            sync
          </span>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading notifications...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>
            <span className="material-icons" style={{ fontSize: '36px', color: Colors.tertiary }}>
              notifications_active
            </span>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span style={{ color: Colors.onSurfaceVariant, fontSize: '15px', marginTop: '8px', display: 'block', fontWeight: 600 }}>
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="small" onClick={markAllAsRead} icon="done_all" style={{ border: `2px solid ${Colors.outlineVariant}` }}>
            Mark all read
          </Button>
        )}
      </header>

      {notifications.length === 0 ? (
        <Card variant="elevated" style={emptyStyle}>
          <span
            className="material-icons"
            style={{ fontSize: '96px', color: Colors.tertiary, marginBottom: '24px', display: 'block', opacity: 0.5 }}
          >
            notifications_none
          </span>
          <h2 style={{ color: Colors.onSurface, marginBottom: '12px', fontSize: '28px', fontWeight: 700 }}>
            All caught up!
          </h2>
          <p style={{ fontSize: '16px', maxWidth: '500px', margin: '0 auto' }}>
            You'll see alerts here when someone finds your device or sends you a message
          </p>
        </Card>
      ) : (
        <div>
          {notifications.map((notification) => {
            const { icon, color } = getIcon(notification.type)
            return (
              <div
                key={notification.id}
                style={notificationStyle(notification.is_read)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = Colors.surfaceContainerHighest
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = notification.is_read
                    ? Colors.surfaceContainerLow
                    : Colors.surfaceContainerHigh
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: `linear-gradient(135deg, ${color}30 0%, ${color}10 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: `2px solid ${color}40`,
                  }}
                >
                  <span className="material-icons" style={{ color, fontSize: '28px' }}>
                    {icon}
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <h3
                      style={{
                        color: Colors.onSurface,
                        fontSize: '18px',
                        fontWeight: notification.is_read ? 500 : 700,
                        marginBottom: '6px',
                        letterSpacing: '-0.2px',
                      }}
                    >
                      {notification.title}
                    </h3>
                    <span style={{ color: Colors.onSurfaceVariant, fontSize: '13px', fontWeight: 600 }}>
                      {getTimeAgo(notification.created_at)}
                    </span>
                  </div>
                  <p style={{ color: Colors.onSurfaceVariant, fontSize: '15px', lineHeight: '1.5' }}>
                    {notification.body}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: Colors.primary,
                        cursor: 'pointer',
                        padding: '8px',
                      }}
                      title="Mark as read"
                    >
                      <span className="material-icons" style={{ fontSize: '20px' }}>
                        done
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: Colors.error,
                      cursor: 'pointer',
                      padding: '8px',
                    }}
                    title="Delete"
                  >
                    <span className="material-icons" style={{ fontSize: '20px' }}>
                      delete
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
