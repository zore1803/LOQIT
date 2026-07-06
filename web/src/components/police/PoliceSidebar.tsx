import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Colors } from '../../lib/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'

const policeNavItems = [
  { path: '/police', icon: 'dashboard', label: 'Dashboard', exact: true },
  { path: '/police/chats', icon: 'forum', label: 'All Chats' },
  { path: '/police/devices', icon: 'devices', label: 'Lost Devices' },
  { path: '/police/reports', icon: 'description', label: 'Reports' },
  { path: '/police/search', icon: 'search', label: 'Search' },
  { path: '/police/analytics', icon: 'analytics', label: 'Analytics' },
  { path: '/police/settings', icon: 'settings', label: 'Settings' },
]

export function PoliceSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const [activeChatsCount, setActiveChatsCount] = useState(0)
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)

  useEffect(() => {
    const fetchActiveChats = async () => {
      const { count } = await db
        .from('chat_rooms')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      setActiveChatsCount(count || 0)
    }
    fetchActiveChats()
    const interval = setInterval(fetchActiveChats, 30000)
    return () => clearInterval(interval)
  }, [])

  const initials = profile?.full_name
    ?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PO'

  const isActive = (item: typeof policeNavItems[0]) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)

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

      {/* Red glow for police theme */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '200px', height: '200px',
        background: `radial-gradient(circle at 0% 0%, ${Colors.error}14 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Logo + Police badge */}
      <div
        onClick={() => navigate('/police')}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', marginBottom: '8px', cursor: 'pointer', position: 'relative', zIndex: 1 }}
      >
        <img src="/logo.png" alt="LOQIT" style={{ height: '28px', objectFit: 'contain', filter: 'var(--logo-filter)' }} />
      </div>

      {/* Police Portal badge */}
      <div style={{
        margin: '0 4px 20px',
        padding: '8px 14px',
        background: `linear-gradient(135deg, ${Colors.error}20, ${Colors.error}10)`,
        border: `1px solid ${Colors.error}35`,
        borderRadius: '12px',
        display: 'flex', alignItems: 'center', gap: '8px',
        boxShadow: `0 0 20px ${Colors.error}10`,
      }}>
        <span className="material-icons" style={{ fontSize: '18px', color: Colors.error }}>local_police</span>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: Colors.error, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Police Portal
          </div>
          <div style={{ fontSize: '10px', color: Colors.onSurfaceVariant }}>Authorised Access Only</div>
        </div>
      </div>

      <div style={{ fontSize: '10px', fontWeight: 700, color: Colors.outline, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 12px', marginBottom: '8px' }}>
        Command Centre
      </div>

      {/* Nav Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {policeNavItems.map(item => {
          const active = isActive(item)
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
                  ? `linear-gradient(135deg, ${Colors.error}20, ${Colors.error}10)`
                  : hovered ? Colors.surfaceContainerHigh : 'transparent',
                border: active ? `1px solid ${Colors.error}35` : '1px solid transparent',
                boxShadow: active ? `0 0 16px ${Colors.error}12, inset 0 1px 0 ${Colors.error}15` : 'none',
                color: active ? Colors.error : hovered ? Colors.onSurface : Colors.onSurfaceVariant,
                transition: 'all 0.2s ease',
                fontWeight: active ? 700 : 500,
                fontSize: '14px',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '20%', bottom: '20%',
                  width: '3px', borderRadius: '0 4px 4px 0',
                  background: `linear-gradient(to bottom, ${Colors.error}, #c44)`,
                  boxShadow: `0 0 8px ${Colors.error}80`,
                }} />
              )}
              <span className="material-icons" style={{
                fontSize: '20px',
                color: active ? Colors.error : hovered ? Colors.onSurface : Colors.onSurfaceVariant,
                transition: 'color 0.2s', flexShrink: 0,
              }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.path === '/police/chats' && activeChatsCount > 0 && (
                <span style={{
                  background: `linear-gradient(135deg, ${Colors.secondary}, #06d4a1)`,
                  color: Colors.onSecondary, fontSize: '10px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '10px',
                  boxShadow: `0 0 8px ${Colors.secondary}60`,
                }}>
                  {activeChatsCount}
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
          border: `1px solid ${Colors.error}25`,
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${Colors.error}, #c44)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '14px',
            boxShadow: `0 0 12px ${Colors.error}40`,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: Colors.onSurface, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'Officer'}
            </div>
            <div style={{ fontSize: '11px', color: Colors.error, fontWeight: 600 }}>🔴 Police Officer</div>
          </div>
        </div>
        <div
          onClick={signOut}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${Colors.error}18`; e.currentTarget.style.borderColor = `${Colors.error}40` }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
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
