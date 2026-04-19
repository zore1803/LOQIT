import { CSSProperties, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Colors } from '../lib/colors'
import { useAuth } from '../hooks/useAuth'
import { useDevices } from '../hooks/useDevices'
import { Button } from '../components/Button'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const STATUS_COLOR: Record<string, string> = {
  lost: '#FF4E4E', stolen: '#FF4E4E',
  recovered: '#ffb95f', found: '#ffb95f',
  registered: '#46f1bb',
}
const STATUS_LABEL: Record<string, string> = {
  lost: 'Lost', stolen: 'Stolen',
  recovered: 'Recovered', found: 'Found',
  registered: 'Protected',
}

function StatCard({ label, value, icon, color, path, loading }: {
  label: string; value: number | string; icon: string; color: string; path?: string; loading: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const navigate = useNavigate()
  return (
    <div
      onClick={() => path && navigate(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${Colors.surfaceContainerHigh}, ${Colors.surfaceContainer})`
          : Colors.surfaceContainer,
        border: `1px solid ${hovered ? color + '50' : Colors.outlineVariant}`,
        borderRadius: '16px',
        padding: '22px 24px',
        display: 'flex', alignItems: 'center', gap: '16px',
        cursor: path ? 'pointer' : 'default',
        transition: 'all 0.25s ease',
        boxShadow: hovered ? `0 8px 32px ${color}20, 0 0 0 1px ${color}20` : '0 1px 4px rgba(0,0,0,0.1)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
        background: `radial-gradient(circle at 100% 0%, ${color}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
        background: `linear-gradient(135deg, ${color}22, ${color}10)`,
        border: `1.5px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 16px ${color}20`,
      }}>
        <span className="material-icons" style={{ fontSize: '22px', color }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: '30px', fontWeight: 900, color: Colors.onSurface, lineHeight: 1, letterSpacing: '-1px' }}>
          {loading ? (
            <div style={{ width: '40px', height: '30px', backgroundColor: Colors.outlineVariant, borderRadius: '4px', opacity: 0.3 }} />
          ) : value}
        </div>
        <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, fontWeight: 600, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { devices, loading } = useDevices()

  const total = devices.length
  const lost = devices.filter(d => d.status === 'lost' || d.status === 'stolen').length
  const safe = devices.filter(d => d.status === 'registered').length
  const recovered = devices.filter(d => d.status === 'recovered' || d.status === 'found').length
  const recentDevices = devices.slice(0, 6)

  const containerStyle: CSSProperties = { padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }

  return (
    <div style={containerStyle}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: Colors.primary, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 style={{
            fontSize: '30px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px',
            background: `linear-gradient(135deg, ${Colors.onSurface} 40%, ${Colors.primary} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, margin: '6px 0 0' }}>
            Here's what's happening with your protected devices.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <Button variant="ghost" onClick={() => navigate('/map')} icon="map" size="small">Live Map</Button>
          <Button onClick={() => navigate('/add-device')} icon="add" size="small">Register Device</Button>
        </div>
      </div>

      {/* Lost Device Alert Banner */}
      {lost > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          background: `linear-gradient(135deg, ${Colors.error}12, ${Colors.error}08)`,
          border: `1px solid ${Colors.error}40`,
          borderRadius: '14px', padding: '16px 20px', marginBottom: '28px',
          boxShadow: `0 4px 24px ${Colors.error}15`,
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
            background: `${Colors.error}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-icons" style={{ color: Colors.error, fontSize: '22px' }}>warning</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: Colors.error, fontSize: '14px' }}>
              {lost} device{lost > 1 ? 's' : ''} reported lost or stolen
            </div>
            <div style={{ color: Colors.onSurfaceVariant, fontSize: '13px', marginTop: '2px' }}>
              Our BLE network is actively scanning for {lost > 1 ? 'them' : 'it'}.
            </div>
          </div>
          <button
            onClick={() => navigate('/devices')}
            style={{
              background: `${Colors.error}20`, border: `1px solid ${Colors.error}50`,
              borderRadius: '10px', padding: '8px 16px', color: Colors.error,
              cursor: 'pointer', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            View devices
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Total Devices" value={total} icon="devices" color={Colors.primary} path="/devices" loading={loading} />
        <StatCard label="Protected" value={safe} icon="verified_user" color="#46f1bb" path="/devices" loading={loading} />
        <StatCard label="At Risk" value={lost} icon="warning" color={lost > 0 ? Colors.error : Colors.onSurfaceVariant} path="/devices" loading={loading} />
        <StatCard label="Recovered" value={recovered} icon="check_circle" color="#ffb95f" path="/devices" loading={loading} />
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>

        {/* Recent Devices */}
        <div style={{
          background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
          borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '18px 22px', borderBottom: `1px solid ${Colors.outlineVariant}`,
            background: `linear-gradient(135deg, ${Colors.surfaceContainerHigh}, ${Colors.surfaceContainer})`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-icons" style={{ fontSize: '18px', color: Colors.primary }}>devices</span>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Recent Devices</h2>
            </div>
            <button
              onClick={() => navigate('/devices')}
              style={{
                background: 'none', border: 'none', color: Colors.primary,
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              View all <span className="material-icons" style={{ fontSize: '16px' }}>arrow_forward</span>
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '24px', gap: '8px', display: 'flex', flexDirection: 'column' }}>
               {[1,2,3].map(i => (
                 <div key={i} style={{ height: '52px', background: Colors.surfaceContainerHigh, borderRadius: '8px', opacity: 0.3 }} />
               ))}
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 16px',
                background: `${Colors.primary}12`, border: `1px solid ${Colors.primary}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-icons" style={{ fontSize: '36px', color: Colors.primary, opacity: 0.6 }}>devices</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: Colors.onSurface, marginBottom: '8px' }}>No devices yet</div>
              <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, marginBottom: '20px', lineHeight: 1.6 }}>
                Register a device to start protecting it with LOQIT.
              </p>
              <Button size="small" onClick={() => navigate('/add-device')} icon="add_circle">Register Device</Button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: `${Colors.surfaceContainerHigh}` }}>
                  {['Device', 'Serial Number', 'Status', 'LOQIT Key', 'Registered'].map(col => (
                    <th key={col} style={{
                      padding: '11px 20px', textAlign: 'left', fontSize: '11px',
                      fontWeight: 700, color: Colors.onSurfaceVariant,
                      textTransform: 'uppercase', letterSpacing: '0.7px',
                      borderBottom: `1px solid ${Colors.outlineVariant}`,
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDevices.map((d, i) => {
                  const color = STATUS_COLOR[d.status] || Colors.primary
                  return (
                    <tr
                      key={d.id}
                      onClick={() => navigate('/devices')}
                      style={{
                        borderBottom: i < recentDevices.length - 1 ? `1px solid ${Colors.outlineVariant}` : 'none',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = Colors.surfaceContainerHigh }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '13px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                            background: `${Colors.primary}15`, border: `1px solid ${Colors.primary}25`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span className="material-icons" style={{ fontSize: '18px', color: Colors.primary }}>smartphone</span>
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: Colors.onSurface }}>{d.make} {d.model}</div>
                            {d.state && <div style={{ fontSize: '11px', color: Colors.onSurfaceVariant }}>{d.state}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '13px', color: Colors.onSurfaceVariant, fontFamily: 'monospace' }}>{d.serial_number || 'N/A'}</td>
                      <td style={{ padding: '13px 20px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                          background: `${color}18`, color, border: `1px solid ${color}30`,
                        }}>
                          {STATUS_LABEL[d.status] || d.status}
                        </span>
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '12px', color: d.loqit_key ? Colors.primary : Colors.outline, fontFamily: 'monospace' }}>
                        {d.loqit_key || '—'}
                      </td>
                      <td style={{ padding: '13px 20px', fontSize: '13px', color: Colors.onSurfaceVariant }}>
                        {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: Colors.outline, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            Quick Actions
          </div>
          {[
            { label: 'Register New Device', icon: 'add_circle', path: '/add-device', color: Colors.primary },
            { label: 'View Live Map', icon: 'map', path: '/map', color: Colors.secondary },
            { label: 'Anti-Theft Settings', icon: 'security', path: '/anti-theft', color: Colors.tertiary },
            { label: 'My Messages', icon: 'chat', path: '/chat', color: '#aac7ff' },
            { label: 'Transfer Ownership', icon: 'swap_horiz', path: '/transfer-ownership', color: Colors.onSurfaceVariant },
          ].map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '13px 16px', borderRadius: '12px',
                background: Colors.surfaceContainer,
                border: `1px solid ${Colors.outlineVariant}`,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'all 0.2s ease', color: Colors.onSurface,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = action.color + '55'
                e.currentTarget.style.background = Colors.surfaceContainerHigh
                e.currentTarget.style.transform = 'translateX(2px)'
                e.currentTarget.style.boxShadow = `0 4px 16px ${action.color}15`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = Colors.outlineVariant
                e.currentTarget.style.background = Colors.surfaceContainer
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                background: `${action.color}18`, border: `1px solid ${action.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: action.color }}>{action.icon}</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 500, flex: 1 }}>{action.label}</span>
              <span className="material-icons" style={{ fontSize: '16px', color: Colors.outline }}>chevron_right</span>
            </button>
          ))}

          {/* BLE Status Card */}
          <div style={{
            marginTop: '8px', padding: '16px',
            background: `linear-gradient(135deg, ${Colors.primary}12, ${Colors.accent}08)`,
            border: `1px solid ${Colors.primary}25`,
            borderRadius: '14px',
            boxShadow: `0 0 24px ${Colors.primary}10`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                background: Colors.secondary, boxShadow: `0 0 8px ${Colors.secondary}`,
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: Colors.primary, textTransform: 'uppercase', letterSpacing: '1px' }}>
                BLE Network Active
              </span>
            </div>
            <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, lineHeight: 1.5 }}>
              Passively scanning for lost devices nearby.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
