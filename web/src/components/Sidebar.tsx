import { CSSProperties, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Colors } from '../lib/colors'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'

const navItems = [
  { path: '/dashboard', icon: 'home', label: 'Home' },
  { path: '/devices', icon: 'devices', label: 'Devices' },
  { path: '/add-device', icon: 'add_circle', label: 'Add Device' },
  { path: '/map', icon: 'map', label: 'Live Map' },
  { path: '/anti-theft', icon: 'security', label: 'Anti-Theft' },
  { path: '/transfer-ownership', icon: 'swap_horiz', label: 'Transfer' },
  { path: '/chat', icon: 'chat', label: 'Chat', showBadge: true },
  { path: '/alerts', icon: 'notifications', label: 'Alerts' },
  { path: '/profile', icon: 'person', label: 'Profile' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  useEffect(() => {
    if (!user?.id) return
    const fetchUnreadCount = async () => {
      try {
        const { data: rooms } = await db
          .from('chat_rooms')
          .select('id')
          .eq('owner_id', user.id)
          .eq('is_active', true)
        if (!rooms || rooms.length === 0) { setUnreadCount(0); return }
        const { count } = await db
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .in('room_id', rooms.map((r: any) => r.id))
          .eq('is_read', false)
          .neq('sender_role', 'owner')
        setUnreadCount(count || 0)
      } catch (e) { console.error(e) }
    }
    fetchUnreadCount()
    const channel = db.channel('unread_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, fetchUnreadCount)
      .subscribe()
    return () => { db.removeChannel(channel) }
  }, [user?.id])

  const initials = profile?.full_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'LQ'

  return (
    <aside style={{
      width: '256px',
      minHeight: '100vh',
      background: 'color-mix(in srgb, var(--color-surfaceContainerLowest) 92%, transparent)',
      backdropFilter: 'blur(20px)',
      padding: '20px 12px',
      display: 'flex',
      flexDirection: 'column',
      borderRight: `1px solid ${Colors.outlineVariant}`,
      position: 'relative',
      flexShrink: 0,
    }}>

      {/* Subtle glow accent top-left */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '180px', height: '180px',
        background: `radial-gradient(circle at 0% 0%, ${Colors.primary}18 0%, transparent 70%)`,
        pointerEvents: 'none', borderRadius: '0 0 100% 0',
      }} />

      {/* Logo */}
      <div
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px', marginBottom: '28px', cursor: 'pointer',
          position: 'relative', zIndex: 1,
        }}
      >
        <img src="/logo.png" alt="LOQIT" style={{ height: '30px', width: 'auto', objectFit: 'contain', filter: 'var(--logo-filter)' }} />
      </div>

      {/* Nav section label */}
      <div style={{ fontSize: '10px', fontWeight: 700, color: Colors.outline, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 12px', marginBottom: '8px' }}>
        Navigation
      </div>

      {/* Nav Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {navItems.map((item) => {
          const active = isActive(item.path)
          const hovered = hoveredPath === item.path
          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => setHoveredPath(item.path)}
              onMouseLeave={() => setHoveredPath(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 14px', borderRadius: '12px',
                position: 'relative', cursor: 'pointer',
                background: active
                  ? `linear-gradient(135deg, ${Colors.primary}22, ${Colors.accent}18)`
                  : hovered ? Colors.surfaceContainerHigh : 'transparent',
                border: active ? `1px solid ${Colors.primary}35` : '1px solid transparent',
                boxShadow: active ? `0 0 16px ${Colors.primary}15, inset 0 1px 0 ${Colors.primary}20` : 'none',
                color: active ? Colors.primary : hovered ? Colors.onSurface : Colors.onSurfaceVariant,
                transition: 'all 0.2s ease',
                fontWeight: active ? 700 : 500,
                fontSize: '14px',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '20%', bottom: '20%',
                  width: '3px', borderRadius: '0 4px 4px 0',
                  background: `linear-gradient(to bottom, ${Colors.primary}, ${Colors.accent})`,
                  boxShadow: `0 0 8px ${Colors.primary}80`,
                }} />
              )}
              <span className="material-icons" style={{
                fontSize: '20px',
                color: active ? Colors.primary : hovered ? Colors.onSurface : Colors.onSurfaceVariant,
                transition: 'color 0.2s',
                flexShrink: 0,
              }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.showBadge && unreadCount > 0 && (
                <span style={{
                  background: `linear-gradient(135deg, ${Colors.error}, #c44)`,
                  color: '#fff', fontSize: '10px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '10px',
                  boxShadow: `0 0 8px ${Colors.error}60`,
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Profile section */}
      <div style={{ borderTop: `1px solid ${Colors.outlineVariant}`, paddingTop: '14px', marginTop: '14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 14px', borderRadius: '12px', marginBottom: '8px',
          background: Colors.surfaceContainer,
          border: `1px solid ${Colors.outlineVariant}`,
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: Colors.onPrimary, fontWeight: 700, fontSize: '14px',
            boxShadow: `0 0 12px ${Colors.primary}40`,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: Colors.onSurface, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'LOQIT User'}
            </div>
            <div style={{ fontSize: '11px', color: Colors.primary, fontWeight: 600 }}>
              {profile?.role === 'police' ? '🔵 Police Officer' : profile?.role === 'admin' ? '⭐ Admin' : 'Civilian'}
            </div>
          </div>
        </div>

        <div
          onClick={signOut}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${Colors.error}18`; e.currentTarget.style.borderColor = `${Colors.error}40` }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px', borderRadius: '10px',
            cursor: 'pointer', color: Colors.error,
            border: '1px solid transparent',
            transition: 'all 0.2s ease', fontSize: '14px', fontWeight: 500,
          }}
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>logout</span>
          Sign Out
        </div>
      </div>
    </aside>
  )
}
