import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Smartphone, PlusCircle, MapPin, Shield, ArrowLeftRight,
  MessageSquare, Bell, User, Settings, LogOut, LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { db } from '../lib/db'

/**
 * Sidebar in the DataCircles CRM's chrome style: a pale --crm-chrome wash, a
 * white pill for the active item, and lucide icons.
 */
const C = {
  chrome: 'var(--crm-chrome)',
  card: 'var(--crm-card)',
  tileBorder: 'var(--crm-tile-border)',
  heading: 'var(--crm-heading)',
  label: 'var(--crm-label)',
  muted: 'var(--crm-muted)',
  primary: 'var(--crm-primary)',
}

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"

type NavItem = { path: string; icon: LucideIcon; label: string; showBadge?: boolean }

const navItems: NavItem[] = [
  { path: '/dashboard', icon: Home, label: 'Home' },
  { path: '/devices', icon: Smartphone, label: 'Devices' },
  { path: '/add-device', icon: PlusCircle, label: 'Add Device' },
  { path: '/map', icon: MapPin, label: 'Live Map' },
  { path: '/anti-theft', icon: Shield, label: 'Anti-Theft' },
  { path: '/transfer-ownership', icon: ArrowLeftRight, label: 'Transfer' },
  { path: '/chat', icon: MessageSquare, label: 'Chat', showBadge: true },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, signOut } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

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
      width: '248px',
      minHeight: '100vh',
      background: C.chrome,
      padding: '16px 10px',
      display: 'flex',
      flexDirection: 'column',
      borderRight: `1px solid ${C.tileBorder}`,
      flexShrink: 0,
      fontFamily: FONT,
    }}>
      <style>{`
        .crm-nav:hover { background: rgba(255,255,255,.6) }
        .crm-signout:hover { background: #FEF2F2; border-color: #FECACA !important }
      `}</style>

      {/* Logo */}
      <div
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', marginBottom: '14px', cursor: 'pointer',
          background: C.card, border: `1px solid ${C.tileBorder}`,
          borderRadius: '10px',
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px', color: C.heading }}>LOQIT</span>
      </div>

      <div style={{
        fontSize: '11px', fontWeight: 700, color: '#5B5A64',
        letterSpacing: '0.8px', textTransform: 'uppercase',
        padding: '0 12px', marginBottom: '8px',
      }}>
        Navigation
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <div
              key={item.path}
              className={active ? undefined : 'crm-nav'}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 14px', borderRadius: '999px',
                cursor: 'pointer',
                background: active ? C.card : 'transparent',
                border: `1px solid ${active ? C.tileBorder : 'transparent'}`,
                color: active ? C.primary : C.heading,
                transition: 'background .15s ease, color .15s ease',
                fontWeight: active ? 600 : 500,
                fontSize: '13.5px',
              }}
            >
              <item.icon
                size={18}
                strokeWidth={active ? 2 : 1.75}
                color={active ? C.primary : C.label}
                style={{ flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.showBadge && unreadCount > 0 && (
                <span style={{
                  background: '#DC2626', color: '#fff',
                  fontSize: '10px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '999px',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Profile + sign out */}
      <div style={{ paddingTop: '12px', marginTop: '12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
          background: C.card, border: `1px solid ${C.tileBorder}`,
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '999px', flexShrink: 0,
            background: C.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 600, fontSize: '13px',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: C.heading, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'LOQIT User'}
            </div>
            <div style={{ fontSize: '11px', color: C.muted, fontWeight: 500 }}>
              {profile?.role === 'police' ? 'Police Officer' : profile?.role === 'admin' ? 'Admin' : 'Civilian'}
            </div>
          </div>
        </div>

        <div
          className="crm-signout"
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 14px', borderRadius: '10px',
            cursor: 'pointer', color: '#DC2626',
            border: '1px solid transparent',
            transition: 'background .15s ease, border-color .15s ease',
            fontSize: '13.5px', fontWeight: 500,
          }}
        >
          <LogOut size={17} strokeWidth={1.75} />
          Sign Out
        </div>
      </div>
    </aside>
  )
}
