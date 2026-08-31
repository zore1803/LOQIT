import { CSSProperties, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Smartphone, ShieldCheck, AlertTriangle, CheckCircle2, MoreVertical,
  MapPin, PlusCircle, Shield, MessageSquare, ArrowLeftRight, ChevronRight,
  ArrowUpRight, RefreshCw, WifiOff,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useDevices } from '../hooks/useDevices'

/**
 * Dashboard, styled to match the DataCircles CRM frontend: white cards on a
 * light page, hairline #F2F2F7 borders, 20px radii, a muted grey label above a
 * near-black value, and compact 56px stat tiles. Tokens live as CSS variables
 * (--crm-*) in styles/global.ts so the dark theme still works.
 */

// ── CRM tokens ──────────────────────────────────────────────────────────────
const C = {
  page: 'var(--crm-page)',
  card: 'var(--crm-card)',
  border: 'var(--crm-border)',
  tile: 'var(--crm-tile)',
  tileBorder: 'var(--crm-tile-border)',
  heading: 'var(--crm-heading)',
  label: 'var(--crm-label)',
  muted: 'var(--crm-muted)',
  primary: 'var(--crm-primary)',
  shadow: 'var(--crm-shadow)',
}

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"

const card: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: '20px',
  boxShadow: C.shadow,
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const STATUS_COLOR: Record<string, string> = {
  lost: '#DC2626', stolen: '#DC2626',
  recovered: '#D97706', found: '#D97706',
  registered: '#059669',
}
const STATUS_LABEL: Record<string, string> = {
  lost: 'Lost', stolen: 'Stolen',
  recovered: 'Recovered', found: 'Found',
  registered: 'Protected',
}

// ── primitives ──────────────────────────────────────────────────────────────

/** The CRM's shared loading placeholder: a pulsing grey block. */
function Skeleton({ width = '100%', height = 14, radius = 6, style }: {
  width?: number | string; height?: number | string; radius?: number; style?: CSSProperties
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: `${radius}px`,
        background: C.tileBorder,
        animation: 'crmPulse 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/** CRM summary card: muted label, big value, small trailing note. */
function SummaryCard({ label, value, note, icon: Icon, tone, loading, onClick }: {
  label: string; value: number | string; note?: string; icon: LucideIcon
  tone: string; loading: boolean; onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...card,
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .18s ease, border-color .18s ease',
        borderColor: hover ? C.tileBorder : C.border,
        boxShadow: hover ? '0 4px 16px rgba(17,18,22,0.06)' : C.shadow,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Icon size={16} strokeWidth={1.75} color={tone} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '13px', color: C.label, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </p>
        </div>
        <MoreVertical size={16} color={C.muted} style={{ flexShrink: 0, opacity: 0.5 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px' }}>
        {loading
          ? <Skeleton width={56} height={28} />
          : <h3 style={{ fontSize: '24px', fontWeight: 700, color: C.heading, margin: 0, lineHeight: 1.1 }}>{value}</h3>}
        {note && !loading && (
          <p style={{ fontSize: '11px', color: C.muted, fontWeight: 500, margin: 0, whiteSpace: 'nowrap' }}>{note}</p>
        )}
      </div>
    </div>
  )
}

/** The CRM's compact 56px stat tile. */
function StatTile({ label, value, icon: Icon, tone, loading }: {
  label: string; value: string; icon: LucideIcon; tone: string; loading: boolean
}) {
  return (
    <div style={{
      height: '56px', display: 'flex', alignItems: 'center', gap: '8px',
      padding: '0 12px', background: C.tile,
      border: `1px solid ${C.tileBorder}`, borderRadius: '12px', minWidth: 0,
    }}>
      <Icon size={20} strokeWidth={1.5} color={tone} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: '11px', color: C.label, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        {loading
          ? <Skeleton width={64} height={14} style={{ marginTop: '4px' }} />
          : <p style={{ fontSize: '14px', fontWeight: 600, color: C.heading, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>}
      </div>
    </div>
  )
}

function Button({ children, onClick, icon: Icon, variant = 'primary' }: {
  children: React.ReactNode; onClick: () => void; icon?: LucideIcon; variant?: 'primary' | 'ghost'
}) {
  const [hover, setHover] = useState(false)
  const primary = variant === 'primary'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', borderRadius: '12px', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600, fontFamily: FONT,
        background: primary ? (hover ? 'var(--crm-primary-hover)' : C.primary) : C.card,
        color: primary ? '#fff' : C.heading,
        border: `1px solid ${primary ? 'transparent' : C.border}`,
        boxShadow: C.shadow,
        transition: 'background .15s ease',
      }}
    >
      {Icon && <Icon size={15} strokeWidth={2} />}
      {children}
    </button>
  )
}

// ── page ────────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { devices, loading, error, refetch } = useDevices()

  const total = devices.length
  const lost = devices.filter(d => d.status === 'lost' || d.status === 'stolen').length
  const safe = devices.filter(d => d.status === 'registered').length
  const recovered = devices.filter(d => d.status === 'recovered' || d.status === 'found').length
  const recentDevices = devices.slice(0, 6)

  const withKey = devices.filter(d => d.loqit_key).length
  const broadcasting = devices.filter(d => d.is_ble_active).length
  const lastSeen = devices
    .map(d => d.last_seen_at)
    .filter(Boolean)
    .sort()
    .reverse()[0]

  const quickActions: Array<{ label: string; icon: LucideIcon; path: string }> = [
    { label: 'Register New Device', icon: PlusCircle, path: '/add-device' },
    { label: 'View Live Map', icon: MapPin, path: '/map' },
    { label: 'Anti-Theft Settings', icon: Shield, path: '/anti-theft' },
    { label: 'My Messages', icon: MessageSquare, path: '/chat' },
    { label: 'Transfer Ownership', icon: ArrowLeftRight, path: '/transfer-ownership' },
  ]

  return (
    <div style={{ background: C.page, minHeight: '100%', fontFamily: FONT }}>
      <style>{`
        @keyframes crmPulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        .crm-row:hover { background: var(--crm-tile) }
        .crm-action:hover { border-color: var(--crm-primary) !important; background: var(--crm-tile) }
        @media (max-width: 1100px) {
          .crm-summary { grid-template-columns: repeat(2, 1fr) !important }
          .crm-main { grid-template-columns: 1fr !important }
        }
        @media (max-width: 640px) {
          .crm-summary, .crm-tiles { grid-template-columns: 1fr !important }
        }
      `}</style>

      <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: C.heading, margin: '0 0 4px' }}>
              {getGreeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p style={{ fontSize: '14px', color: C.muted, fontWeight: 500, margin: 0 }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}Here's what's happening with your protected devices.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <Button variant="ghost" onClick={() => navigate('/map')} icon={MapPin}>Live Map</Button>
            <Button onClick={() => navigate('/add-device')} icon={PlusCircle}>Register Device</Button>
          </div>
        </div>

        {/* Connection error — previously this state showed skeletons forever */}
        {error && (
          <div style={{
            ...card, display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 18px', marginBottom: '20px', borderColor: '#FECACA', background: '#FEF2F2',
          }}>
            <WifiOff size={18} color="#DC2626" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B' }}>Can't reach the LOQIT server</div>
              <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '1px' }}>{error}</div>
            </div>
            <button
              onClick={() => refetch()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '10px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                background: '#fff', color: '#991B1B', border: '1px solid #FECACA',
              }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Lost device banner */}
        {lost > 0 && !error && (
          <div style={{
            ...card, display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 18px', marginBottom: '20px', borderColor: '#FDE68A', background: '#FFFBEB',
          }}>
            <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400E' }}>
                {lost} device{lost > 1 ? 's' : ''} reported lost or stolen
              </div>
              <div style={{ fontSize: '12px', color: '#B45309', marginTop: '1px' }}>
                The BLE network is actively scanning for {lost > 1 ? 'them' : 'it'}.
              </div>
            </div>
            <button
              onClick={() => navigate('/devices')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '7px 12px', borderRadius: '10px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                background: '#fff', color: '#92400E', border: '1px solid #FDE68A',
              }}
            >
              View devices <ArrowUpRight size={13} />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="crm-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
          <SummaryCard label="Total Devices" value={total} icon={Smartphone} tone={C.primary} loading={loading} onClick={() => navigate('/devices')} note={total ? 'registered' : undefined} />
          <SummaryCard label="Protected" value={safe} icon={ShieldCheck} tone="#059669" loading={loading} onClick={() => navigate('/devices')} note={total ? `${Math.round((safe / total) * 100)}% of fleet` : undefined} />
          <SummaryCard label="At Risk" value={lost} icon={AlertTriangle} tone={lost > 0 ? '#DC2626' : C.muted} loading={loading} onClick={() => navigate('/devices')} note={lost > 0 ? 'needs attention' : 'all clear'} />
          <SummaryCard label="Recovered" value={recovered} icon={CheckCircle2} tone="#D97706" loading={loading} onClick={() => navigate('/devices')} note={recovered ? 'returned' : undefined} />
        </div>

        {/* Compact tiles */}
        <div className="crm-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <StatTile label="LOQIT keys issued" value={`${withKey} of ${total}`} icon={ShieldCheck} tone={C.primary} loading={loading} />
          <StatTile label="Broadcasting now" value={`${broadcasting} device${broadcasting === 1 ? '' : 's'}`} icon={MapPin} tone="#059669" loading={loading} />
          <StatTile
            label="Last beacon sighting"
            value={lastSeen ? new Date(lastSeen).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No sightings yet'}
            icon={Smartphone}
            tone="#D97706"
            loading={loading}
          />
        </div>

        {/* Main grid */}
        <div className="crm-main" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

          {/* Recent devices */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: '0 0 2px' }}>Recent Devices</h2>
                <p style={{ fontSize: '13px', color: C.muted, fontWeight: 500, margin: 0 }}>Your most recently registered hardware</p>
              </div>
              <button
                onClick={() => navigate('/devices')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700, color: C.primary, fontFamily: FONT,
                }}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton width={36} height={36} radius={10} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="42%" height={13} />
                      <Skeleton width="24%" height={11} style={{ marginTop: '6px' }} />
                    </div>
                    <Skeleton width={72} height={22} radius={8} />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div style={{ padding: '44px 24px', textAlign: 'center' }}>
                <WifiOff size={28} color={C.muted} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: C.heading, margin: '12px 0 4px' }}>Couldn't load your devices</div>
                <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 16px' }}>The server didn't respond. Your data is safe.</p>
                <Button variant="ghost" onClick={() => refetch()} icon={RefreshCw}>Try again</Button>
              </div>
            ) : devices.length === 0 ? (
              <div style={{ padding: '44px 24px', textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px', margin: '0 auto 12px',
                  background: C.tile, border: `1px solid ${C.tileBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Smartphone size={22} color={C.muted} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: C.heading, marginBottom: '4px' }}>No devices yet</div>
                <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 16px' }}>Register a device to start protecting it with LOQIT.</p>
                <Button onClick={() => navigate('/add-device')} icon={PlusCircle}>Register Device</Button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Device', 'Serial Number', 'Status', 'LOQIT Key', 'Registered'].map(col => (
                        <th key={col} style={{
                          padding: '10px 24px', textAlign: 'left', fontSize: '11px',
                          fontWeight: 600, color: C.label, whiteSpace: 'nowrap',
                          borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
                          background: C.tile,
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentDevices.map((d, i) => {
                      const tone = STATUS_COLOR[d.status] || C.primary
                      return (
                        <tr
                          key={d.id}
                          className="crm-row"
                          onClick={() => navigate('/devices')}
                          style={{
                            cursor: 'pointer',
                            borderBottom: i < recentDevices.length - 1 ? `1px solid ${C.border}` : 'none',
                            transition: 'background .15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                                background: C.tile, border: `1px solid ${C.tileBorder}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Smartphone size={17} color={C.primary} strokeWidth={1.75} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{d.make} {d.model}</div>
                                {d.state && <div style={{ fontSize: '11px', color: C.muted }}>{d.state}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 24px', fontSize: '12px', color: C.label, fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>
                            {d.serial_number || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 24px' }}>
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
                              fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                              background: `${tone}14`, color: tone, border: `1px solid ${tone}33`,
                            }}>
                              {STATUS_LABEL[d.status] || d.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 24px', fontSize: '12px', fontFamily: 'ui-monospace, monospace', color: d.loqit_key ? C.primary : C.muted, whiteSpace: 'nowrap' }}>
                            {d.loqit_key || '—'}
                          </td>
                          <td style={{ padding: '12px 24px', fontSize: '12px', color: C.label, whiteSpace: 'nowrap' }}>
                            {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ ...card, padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: '0 0 2px' }}>Quick Actions</h2>
            <p style={{ fontSize: '13px', color: C.muted, fontWeight: 500, margin: '0 0 16px' }}>Jump straight to what you need</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {quickActions.map(action => (
                <button
                  key={action.path}
                  className="crm-action"
                  onClick={() => navigate(action.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '11px 12px', borderRadius: '12px', width: '100%',
                    background: C.card, border: `1px solid ${C.border}`,
                    cursor: 'pointer', textAlign: 'left', color: C.heading,
                    fontFamily: FONT, transition: 'border-color .15s ease, background .15s ease',
                  }}
                >
                  <action.icon size={17} strokeWidth={1.75} color={C.primary} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 500, flex: 1 }}>{action.label}</span>
                  <ChevronRight size={15} color={C.muted} />
                </button>
              ))}
            </div>

            <div style={{
              marginTop: '16px', padding: '14px',
              background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%', background: '#059669',
                  animation: 'crmPulse 2s ease-in-out infinite', flexShrink: 0,
                }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', letterSpacing: '0.4px' }}>
                  BLE NETWORK ACTIVE
                </span>
              </div>
              <div style={{ fontSize: '12px', color: C.label, lineHeight: 1.5 }}>
                Passively scanning for lost devices nearby.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
