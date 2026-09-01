import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, MessagesSquare, Smartphone, FileText, Search,
  BarChart3, Settings, LogOut, ShieldAlert, LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/db'

/**
 * Police sidebar. Same CRM chrome as the civilian one, with red as the accent
 * so the portal is unmistakable without resorting to gradients and glows.
 */
const C = {
  chrome: 'var(--crm-chrome)',
  card: 'var(--crm-card)',
  tileBorder: 'var(--crm-tile-border)',
  heading: 'var(--crm-heading)',
  label: 'var(--crm-label)',
  muted: 'var(--crm-muted)',
}

const RED = '#DC2626'
const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"

type PoliceNavItem = { path: string; icon: LucideIcon; label: string; exact?: boolean }

const policeNavItems: PoliceNavItem[] = [
  { path: '/police', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/police/chats', icon: MessagesSquare, label: 'All Chats' },
  { path: '/police/devices', icon: Smartphone, label: 'Lost Devices' },
  { path: '/police/reports', icon: FileText, label: 'Reports' },
  { path: '/police/search', icon: Search, label: 'Search' },
  { path: '/police/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/police/settings', icon: Settings, label: 'Settings' },
]

export function PoliceSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const [activeChatsCount, setActiveChatsCount] = useState(0)

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

  const isActive = (item: PoliceNavItem) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)

  return (
    <aside style={{
      width: '248px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: C.chrome,
      padding: '16px 10px',
      display: 'flex',
      flexDirection: 'column',
      borderRight: `1px solid ${C.tileBorder}`,
      flexShrink: 0,
      fontFamily: FONT,
      overflowY: 'auto',
    }}>
      <style>{`
        .crm-pnav:hover { background: rgba(255,255,255,.6) }
        .crm-psignout:hover { background: #FEF2F2; border-color: #FECACA !important }
      `}</style>

      {/* Wordmark */}
      <div
        onClick={() => navigate('/police')}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', marginBottom: '10px', cursor: 'pointer',
          background: C.card, border: `1px solid ${C.tileBorder}`,
          borderRadius: '10px',
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px', color: C.heading }}>LOQIT</span>
      </div>

      {/* Portal badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '10px 12px', marginBottom: '16px',
        background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
      }}>
        <ShieldAlert size={17} color={RED} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', letterSpacing: '0.4px' }}>
            POLICE PORTAL
          </div>
          <div style={{ fontSize: '10.5px', color: '#B91C1C', marginTop: '1px' }}>
            Authorised access only
          </div>
        </div>
      </div>

      <div style={{
        fontSize: '11px', fontWeight: 700, color: '#5B5A64',
        letterSpacing: '0.8px', textTransform: 'uppercase',
        padding: '0 12px', marginBottom: '8px',
      }}>
        Command Centre
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {policeNavItems.map(item => {
          const active = isActive(item)
          return (
            <div
              key={item.path}
              className={active ? undefined : 'crm-pnav'}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 14px', borderRadius: '999px',
                cursor: 'pointer',
                background: active ? C.card : 'transparent',
                border: `1px solid ${active ? C.tileBorder : 'transparent'}`,
                color: active ? RED : C.heading,
                transition: 'background .15s ease, color .15s ease',
                fontWeight: active ? 600 : 500,
                fontSize: '13.5px',
              }}
            >
              <item.icon
                size={18}
                strokeWidth={active ? 2 : 1.75}
                color={active ? RED : C.label}
                style={{ flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.path === '/police/chats' && activeChatsCount > 0 && (
                <span style={{
                  background: '#059669', color: '#fff',
                  fontSize: '10px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '999px',
                }}>
                  {activeChatsCount}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Officer + sign out */}
      <div style={{ paddingTop: '12px', marginTop: '12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
          background: C.card, border: `1px solid ${C.tileBorder}`,
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '999px', flexShrink: 0,
            background: RED, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: '13px',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: C.heading, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'Officer'}
            </div>
            <div style={{ fontSize: '11px', color: C.muted, fontWeight: 500 }}>Police Officer</div>
          </div>
        </div>

        <div
          className="crm-psignout"
          onClick={signOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 14px', borderRadius: '10px',
            cursor: 'pointer', color: RED,
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
