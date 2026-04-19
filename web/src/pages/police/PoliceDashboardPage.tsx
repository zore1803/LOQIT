import { CSSProperties, useEffect, useState } from 'react'
import { Colors } from '../../lib/colors'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'

type DeviceLocation = {
  id: string
  device_id: string
  latitude: number
  longitude: number
  reported_at: string
  device_name: string
  status: string
}

type DashboardStats = {
  totalLostDevices: number
  activeReports: number
  totalChats: number
  devicesRecovered: number
  recentAlerts: number
  totalUsers: number
}

type RecentActivity = {
  id: string
  type: 'report' | 'chat' | 'beacon' | 'recovery' | 'theft_alert'
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
}

const containerStyle: CSSProperties = { padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }
const mapContainerUiStyle = { width: '100%', height: '100%' }

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1d24' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1d24' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
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
            <span className="material-icons" style={{ fontSize: '22px', animation: 'spin 1s linear infinite', color: Colors.outline }}>sync</span>
          ) : value}
        </div>
        <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, fontWeight: 600, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
      </div>
    </div>
  )
}

export function PoliceDashboardPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalLostDevices: 0,
    activeReports: 0,
    totalChats: 0,
    devicesRecovered: 0,
    recentAlerts: 0,
    totalUsers: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [lostDevices, setLostDevices] = useState<DeviceLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDevice, setSelectedDevice] = useState<DeviceLocation | null>(null)

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  useEffect(() => {
    console.log('[GoogleMaps Debug] Key loaded:', googleMapsApiKey ? 'Yes (starts with ' + googleMapsApiKey.slice(0, 5) + '...)' : 'No')
  }, [googleMapsApiKey])

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey
  })

  useEffect(() => {
    if (loadError) {
      console.error('[GoogleMaps Debug] Load Error:', loadError)
    }
  }, [loadError])

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 15000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      const [
        lostDevicesRes,
        activeReportsRes,
        chatsRes,
        recoveredRes,
        alertsRes,
        usersRes,
      ] = await Promise.all([
        supabase.from('devices').select('*', { count: 'exact', head: true }).in('status', ['lost', 'stolen']),
        supabase.from('lost_reports').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('chat_rooms').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('devices').select('*', { count: 'exact', head: true }).in('status', ['found', 'recovered']),
        supabase.from('beacon_logs').select('*', { count: 'exact', head: true }).gte('reported_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'civilian'),
      ])

      setStats({
        totalLostDevices: lostDevicesRes.count || 0,
        activeReports: activeReportsRes.count || 0,
        totalChats: chatsRes.count || 0,
        devicesRecovered: recoveredRes.count || 0,
        recentAlerts: alertsRes.count || 0,
        totalUsers: usersRes.count || 0,
      })

      await loadRecentActivity()
      await loadLostDeviceLocations()
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecentActivity = async () => {
    const activities: RecentActivity[] = []

    const { data: reports } = await supabase
      .from('lost_reports')
      .select('id, reported_at, devices(make, model)')
      .order('reported_at', { ascending: false })
      .limit(3)

    reports?.forEach((report: any) => {
      activities.push({
        id: report.id,
        type: 'report',
        title: 'New Lost Report',
        description: `${report.devices?.make} ${report.devices?.model}`,
        timestamp: report.reported_at,
        icon: 'report',
        color: Colors.error,
      })
    })

    const { data: beacons } = await supabase
      .from('beacon_logs')
      .select('id, reported_at, device_id, devices(make, model)')
      .order('reported_at', { ascending: false })
      .limit(3)

    beacons?.forEach((beacon: any) => {
      activities.push({
        id: beacon.id,
        type: 'beacon',
        title: 'Device Detected',
        description: `${beacon.devices?.make} ${beacon.devices?.model}`,
        timestamp: beacon.reported_at,
        icon: 'my_location',
        color: Colors.secondary,
      })
    })

    const { data: tamperEvents } = await supabase
      .from('anti_theft_events')
      .select('id, event_type, triggered_at, devices(make, model)')
      .order('triggered_at', { ascending: false })
      .limit(3)

    tamperEvents?.forEach((ev: any) => {
      const labels: { [key: string]: string } = {
        'sim_change': 'SIM Card Swap',
        'motion_alert': 'Unusual Motion',
        'camera_capture': 'Intruder Detected',
      }
      activities.push({
        id: ev.id,
        type: 'theft_alert',
        title: labels[ev.event_type] || 'Tamper Alert',
        description: `Device: ${ev.devices?.make} ${ev.devices?.model}`,
        timestamp: ev.triggered_at,
        icon: 'security',
        color: ev.event_type === 'sim_change' ? Colors.error : '#f59e0b',
      })
    })

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setRecentActivity(activities.slice(0, 10))
  }

  const loadLostDeviceLocations = async () => {
    // 1. Fetch devices AND their reports to ensure every lost device has a beacon
    const { data: lostDevicesBase } = await supabase
      .from('devices')
      .select(`
        id, make, model, status, last_seen_lat, last_seen_lng, last_seen_at,
        lost_reports(latitude, longitude, reported_at)
      `)
      .in('status', ['lost', 'stolen'])

    const devicesMap = new Map()

    lostDevicesBase?.forEach((d: any) => {
      // Use live scan location if available, otherwise fallback to the report location
      const report = d.lost_reports && d.lost_reports.length > 0 ? d.lost_reports[0] : null;
      const lat = d.last_seen_lat || report?.latitude;
      const lng = d.last_seen_lng || report?.longitude;
      const seenAt = d.last_seen_at || report?.reported_at;

      if (lat && lng) {
        devicesMap.set(d.id, {
          id: `dev-${d.id}`,
          device_id: d.id,
          latitude: lat,
          longitude: lng,
          reported_at: seenAt,
          device_name: `${d.make} ${d.model}`,
          status: d.status
        })
      }
    })

    // 2. Fetch the absolute latest beacon logs to overlay/update positions
    const { data: beaconLogs } = await supabase
      .from('beacon_logs')
      .select(`
        id, 
        device_id, 
        latitude, 
        longitude, 
        reported_at,
        devices!inner(make, model, status)
      `)
      .in('devices.status', ['lost', 'stolen'])
      .order('reported_at', { ascending: false })

    // Overlay beacon logs (which are more recent recovery signals)
    beaconLogs?.forEach((log: any) => {
      const existing = devicesMap.get(log.device_id)
      // Only update if the beacon log is newer than what we have
      if (!existing || new Date(log.reported_at) > new Date(existing.reported_at)) {
        devicesMap.set(log.device_id, {
          id: log.id,
          device_id: log.device_id,
          latitude: log.latitude,
          longitude: log.longitude,
          reported_at: log.reported_at,
          device_name: `${log.devices.make} ${log.devices.model}`,
          status: log.devices.status
        })
      }
    })

    setLostDevices(Array.from(devicesMap.values()))
  }

  if (loading) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', paddingTop: '120px' }}>
        <span className="material-icons" style={{ fontSize: '48px', color: Colors.primary, animation: 'spin 1s linear infinite' }}>
          sync
        </span>
        <p style={{ marginTop: '16px', color: Colors.onSurfaceVariant }}>Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
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
            {getGreeting()}, Officer {profile?.full_name?.split(' ')[0] || ''} 👋
          </h1>
          <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, margin: '6px 0 0' }}>
            Real-time monitoring and city-wide device recovery operations.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Lost Devices" value={stats.totalLostDevices} icon="warning" color={Colors.error} path="/police/devices" loading={loading} />
        <StatCard label="Active Reports" value={stats.activeReports} icon="description" color={Colors.primary} path="/police/reports" loading={loading} />
        <StatCard label="Recovered" value={stats.devicesRecovered} icon="check_circle" color={Colors.secondary} path="/police/devices" loading={loading} />
        <StatCard label="Protected Users" value={stats.totalUsers} icon="people" color={Colors.tertiary} loading={loading} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ 
            height: '420px', borderRadius: '16px', overflow: 'hidden', position: 'relative', 
            border: `1px solid ${Colors.outlineVariant}`, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' 
          }}>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerUiStyle}
                center={lostDevices.length > 0 ? { lat: lostDevices[0].latitude, lng: lostDevices[0].longitude } : { lat: 19.0760, lng: 72.8777 }}
                zoom={11}
                options={{
                  styles: darkMapStyle,
                  disableDefaultUI: true,
                  zoomControl: true,
                }}
              >
                {lostDevices.map(device => (
                  <Marker
                    key={device.id}
                    position={{ lat: device.latitude, lng: device.longitude }}
                    onClick={() => setSelectedDevice(device)}
                    icon={{
                      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="8" fill="#FF3D71" stroke="white" stroke-width="2"/>
                          <circle cx="20" cy="20" r="18" fill="none" stroke="#FF3D71" stroke-width="2" opacity="0.6">
                            <animate attributeName="r" from="8" to="18" dur="1.5s" begin="0s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" begin="0s" repeatCount="indefinite" />
                          </circle>
                        </svg>
                      `),
                      scaledSize: new google.maps.Size(40, 40),
                      anchor: new google.maps.Point(20, 20),
                    }}
                  />
                ))}

                {selectedDevice && (
                  <InfoWindow
                    position={{ lat: selectedDevice.latitude, lng: selectedDevice.longitude }}
                    onCloseClick={() => setSelectedDevice(null)}
                  >
                    <div style={{ color: '#000', padding: '4px' }}>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>{selectedDevice.device_name}</strong>
                      <div style={{ fontSize: '11px', marginBottom: '4px' }}>Status: {selectedDevice.status.toUpperCase()}</div>
                      <div style={{ fontSize: '10px', opacity: 0.6 }}>Last seen: {new Date(selectedDevice.reported_at).toLocaleString()}</div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#1a1d24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-icons" style={{ animation: 'spin 1.5s linear infinite', color: Colors.outline }}>sync</span>
              </div>
            )}
            
            <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, backgroundColor: 'rgba(17,19,24,0.85)', padding: '10px 16px', borderRadius: '12px', backdropFilter: 'blur(8px)', border: `1px solid ${Colors.outlineVariant}` }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-icons" style={{ color: Colors.error, fontSize: '18px' }}>radar</span>
                {lostDevices.length} Active Incidents Detected
                <div style={{ marginLeft: '4px', width: '8px', height: '8px', backgroundColor: Colors.error, borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
              </div>
            </div>
          </div>

          <div style={{
            background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
            borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 22px', borderBottom: `1px solid ${Colors.outlineVariant}`,
              background: `linear-gradient(135deg, ${Colors.surfaceContainerHigh}, ${Colors.surfaceContainer})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-icons" style={{ fontSize: '18px', color: Colors.error }}>dashboard_customize</span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Live Incident Monitor (Debug)</h2>
              </div>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lostDevices.length === 0 ? (
                <p style={{ color: Colors.onSurfaceVariant, fontSize: '13px' }}>No active lost/stolen beacons found in DB.</p>
              ) : (
                lostDevices.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: Colors.onSurface }}>
                    <strong>{d.device_name}</strong>
                    <span style={{ color: Colors.primary }}>{d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{
            background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
            borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 22px', borderBottom: `1px solid ${Colors.outlineVariant}`,
              background: `linear-gradient(135deg, ${Colors.surfaceContainerHigh}, ${Colors.surfaceContainer})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-icons" style={{ fontSize: '18px', color: Colors.primary }}>history</span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Recent Activity Feed</h2>
              </div>
            </div>

            {recentActivity.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline, marginBottom: '12px' }}>inbox</span>
                <p style={{ color: Colors.onSurfaceVariant }}>No recent activity in the area.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentActivity.map((activity, i) => (
                  <div key={activity.id} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                    borderBottom: i < recentActivity.length - 1 ? `1px solid ${Colors.outlineVariant}` : 'none',
                    borderLeft: `3px solid ${activity.type === 'theft_alert' ? activity.color : 'transparent'}`,
                    transition: 'background 0.2s', background: 'transparent'
                  }} onMouseEnter={e => e.currentTarget.style.background = Colors.surfaceContainerHigh} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      backgroundColor: `${activity.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="material-icons" style={{ fontSize: '20px', color: activity.color }}>{activity.icon}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: Colors.onSurface, fontSize: '14px', marginBottom: '2px' }}>{activity.title}</div>
                      <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>{activity.description}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: Colors.outline, fontWeight: 500 }}>
                      {new Date(activity.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: Colors.outline, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Command Control
          </div>
          
          {[
            { label: 'Incident Reports', icon: 'description', path: '/police/reports', color: Colors.primary },
            { label: 'Device Database', icon: 'devices', path: '/police/devices', color: Colors.secondary },
            { label: 'Global Search', icon: 'search', path: '/police/search', color: Colors.tertiary },
            { label: 'Active Chats', icon: 'forum', path: '/police/chats', color: '#aac7ff' },
            { label: 'City Analytics', icon: 'analytics', path: '/police/analytics', color: Colors.onSurfaceVariant },
          ].map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderRadius: '12px',
                background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
                cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s ease', color: Colors.onSurface,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = action.color + '55'
                e.currentTarget.style.background = Colors.surfaceContainerHigh
                e.currentTarget.style.transform = 'translateY(-2px)'
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
                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                background: `${action.color}15`, border: `1px solid ${action.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: action.color }}>{action.icon}</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>{action.label}</span>
              <span className="material-icons" style={{ fontSize: '16px', color: Colors.outline }}>chevron_right</span>
            </button>
          ))}

          <div style={{
            marginTop: '8px', padding: '18px',
            background: `linear-gradient(135deg, ${Colors.primary}12, ${Colors.accent}08)`,
            border: `1px solid ${Colors.primary}25`, borderRadius: '14px',
            boxShadow: `0 0 24px ${Colors.primary}10`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{
                display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                background: Colors.secondary, boxShadow: `0 0 8px ${Colors.secondary}`,
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: Colors.primary, textTransform: 'uppercase', letterSpacing: '1px' }}>
                System Online
              </span>
            </div>
            <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, lineHeight: 1.5, marginBottom: '12px' }}>
              LOQIT central database is connected. BLE sweeping is actively logging nodes across the grid.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: `1px solid ${Colors.primary}20`, paddingTop: '10px' }}>
              <span style={{ color: Colors.onSurfaceVariant }}>24h Sweeps:</span>
              <span style={{ color: Colors.primary, fontWeight: 700 }}>2400+</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(255, 61, 113, 0.4); }
          70% { transform: scale(1.1); opacity: 0.8; box-shadow: 0 0 0 10px rgba(255, 61, 113, 0); }
          100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(255, 61, 113, 0); }
        }
      `}</style>
    </div>
  )
}
