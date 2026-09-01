import { useEffect, useState } from 'react'
import {
  Smartphone, FileWarning, MessagesSquare, CheckCircle2, Radio, Users,
  MapPin, Shield, FileText, Search, ChevronRight, AlertCircle,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { db } from '../../lib/db'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import {
  C, TONE, FONT, Page, PageHeader, Card, CardHeader,
  SummaryCard, Skeleton, EmptyState, IconTile,
} from '../../components/crm'

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
  icon: LucideIcon
  tone: string
}

const mapContainerUiStyle = { width: '100%', height: '100%' }

// Light basemap so the map matches the rest of the portal.
const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#F7F8FA' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#E5E7EB' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#F2F2F7' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DBEAFE' }] },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours + 'h ago'
  return Math.floor(hours / 24) + 'd ago'
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
        db.from('devices').select('*', { count: 'exact', head: true }).in('status', ['lost', 'stolen']),
        db.from('lost_reports').select('*', { count: 'exact', head: true }).eq('is_active', true),
        db.from('chat_rooms').select('*', { count: 'exact', head: true }).eq('is_active', true),
        db.from('devices').select('*', { count: 'exact', head: true }).in('status', ['found', 'recovered']),
        db.from('beacon_logs').select('*', { count: 'exact', head: true }).gte('reported_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'civilian'),
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

    const { data: reports } = await db
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
        icon: FileWarning,
        tone: TONE.red,
      })
    })

    const { data: beacons } = await db
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
        icon: Radio,
        tone: TONE.green,
      })
    })

    const { data: tamperEvents } = await db
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
        icon: Shield,
        tone: ev.event_type === 'sim_change' ? TONE.red : TONE.amber,
      })
    })

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setRecentActivity(activities.slice(0, 10))
  }

  const loadLostDeviceLocations = async () => {
    // 1. Fetch devices AND their reports to ensure every lost device has a beacon
    const { data: lostDevicesBase } = await db
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
    const { data: beaconLogs } = await db
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


  const quickActions: Array<{ label: string; icon: LucideIcon; path: string; desc: string }> = [
    { label: 'Search a device', icon: Search, path: '/police/search', desc: 'Look up a serial or LOQIT key' },
    { label: 'Open reports', icon: FileText, path: '/police/reports', desc: 'Case files and printable summaries' },
    { label: 'Monitor chats', icon: MessagesSquare, path: '/police/chats', desc: 'Owner and finder conversations' },
  ]

  return (
    <Page>
      <PageHeader
        title={getGreeting() + (profile?.full_name ? ', ' + profile.full_name.split(' ')[0] : '')}
        subtitle="Live status across every device and case in your jurisdiction"
      />

      <div className="crm-c3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Lost or Stolen" value={stats.totalLostDevices} icon={Smartphone} tone={stats.totalLostDevices ? TONE.red : TONE.grey} loading={loading} onClick={() => navigate('/police/devices')} note="active cases" />
        <SummaryCard label="Open Reports" value={stats.activeReports} icon={FileWarning} tone={TONE.amber} loading={loading} onClick={() => navigate('/police/reports')} />
        <SummaryCard label="Active Chats" value={stats.totalChats} icon={MessagesSquare} tone={TONE.blue} loading={loading} onClick={() => navigate('/police/chats')} />
      </div>

      <div className="crm-c3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Devices Recovered" value={stats.devicesRecovered} icon={CheckCircle2} tone={TONE.green} loading={loading} />
        <SummaryCard label="Sightings (24h)" value={stats.recentAlerts} icon={Radio} tone={stats.recentAlerts ? TONE.amber : TONE.grey} loading={loading} note="mesh reports" />
        <SummaryCard label="Registered Civilians" value={stats.totalUsers} icon={Users} tone={TONE.blue} loading={loading} />
      </div>

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: '20px', alignItems: 'start' }}>

        {/* Map */}
        <Card style={{ overflow: 'hidden', position: 'relative', height: '520px' }}>
          {loadError ? (
            <EmptyState
              icon={MapPin}
              title="Map could not load"
              body="Check that VITE_GOOGLE_MAPS_API_KEY is set and the Maps JavaScript API is enabled for it."
            />
          ) : isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerUiStyle}
              center={{ lat: 20.5937, lng: 78.9629 }}
              zoom={5}
              options={{ styles: lightMapStyle, disableDefaultUI: true, zoomControl: true }}
            >
              {lostDevices.map(device => (
                <Marker
                  key={device.id}
                  position={{ lat: device.latitude, lng: device.longitude }}
                  onClick={() => setSelectedDevice(device)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: TONE.red,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                    scale: selectedDevice?.id === device.id ? 10 : 7,
                  }}
                />
              ))}

              {selectedDevice && (
                <InfoWindow
                  position={{ lat: selectedDevice.latitude, lng: selectedDevice.longitude }}
                  onCloseClick={() => setSelectedDevice(null)}
                >
                  <div style={{ fontFamily: FONT, padding: '2px 4px', minWidth: '150px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#111216' }}>{selectedDevice.device_name}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: TONE.red, marginTop: '3px', textTransform: 'capitalize' }}>
                      {selectedDevice.status}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                      Seen {new Date(selectedDevice.reported_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div style={{ padding: '16px', height: '100%' }}>
              <Skeleton width="100%" height="100%" radius={16} />
            </div>
          )}

          {isLoaded && !loadError && (
            <div style={{
              position: 'absolute', top: '16px', left: '16px', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: '9px',
              background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--crm-tile-border)', borderRadius: '12px',
              padding: '9px 14px', fontFamily: FONT,
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: TONE.red }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                {lostDevices.length} located {lostDevices.length === 1 ? 'device' : 'devices'}
              </span>
            </div>
          )}
        </Card>

        {/* Side column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <CardHeader title="Recent Activity" subtitle="Newest first, refreshed every 15s" />
            <div style={{ borderTop: '1px solid var(--crm-border)', maxHeight: '340px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '11px' }}>
                      <Skeleton width={32} height={32} radius={10} />
                      <div style={{ flex: 1 }}>
                        <Skeleton width="50%" height={12} />
                        <Skeleton width="70%" height={10} style={{ marginTop: '6px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <EmptyState icon={AlertCircle} title="Nothing yet" body="Reports, sightings and tamper alerts appear here as they happen." />
              ) : (
                recentActivity.map((item, i) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', gap: '11px', padding: '12px 20px',
                      borderBottom: i < recentActivity.length - 1 ? '1px solid var(--crm-border)' : 'none',
                    }}
                  >
                    <IconTile icon={item.icon} tone={item.tone} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: C.muted, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.description}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" subtitle="Common investigation tasks" />
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {quickActions.map(action => (
                <button
                  key={action.path}
                  className="crm-hoverable"
                  onClick={() => navigate(action.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '11px 12px', borderRadius: '12px', width: '100%',
                    background: C.card, border: '1px solid var(--crm-border)',
                    cursor: 'pointer', textAlign: 'left', color: C.heading, fontFamily: FONT,
                  }}
                >
                  <action.icon size={17} strokeWidth={1.75} color={C.primary} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 500 }}>{action.label}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: C.muted, marginTop: '1px' }}>{action.desc}</span>
                  </span>
                  <ChevronRight size={15} color={C.muted} />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  )
}
