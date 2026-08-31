import { useEffect, useState, CSSProperties } from 'react'
import { MapPin, Smartphone, Radio, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { useDevices, Device } from '../hooks/useDevices'
import { db } from '../lib/db'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import {
  C, TONE, FONT, Page, PageHeader, Card, CardHeader, Badge,
  Skeleton, EmptyState, SummaryCard, IconTile,
} from '../components/crm'

type BeaconLog = {
  id: string
  device_id: string
  latitude: number
  longitude: number
  reported_at: string
  device_make?: string
  device_model?: string
  device_serial?: string
}

const STATUS_COLOR: Record<string, string> = {
  lost: TONE.red,
  stolen: TONE.red,
  recovered: TONE.amber,
  found: TONE.amber,
  registered: TONE.green,
}

const STATUS_LABEL: Record<string, string> = {
  lost: 'Lost',
  stolen: 'Stolen',
  recovered: 'Recovered',
  found: 'Found',
  registered: 'Protected',
}

const mapContainerStyle: CSSProperties = { width: '100%', height: '100%' }

// Light basemap, so the map sits on the light page instead of fighting it.
const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#F7F8FA' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#E5E7EB' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#ECFDF5' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#F2F2F7' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FEF3C7' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DBEAFE' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#93C5FD' }] },
]

const FILTERS = ['all', 'lost', 'registered', 'recovered'] as const

export function LiveMapPage() {
  const { devices, loading } = useDevices()
  const [filter, setFilter] = useState<'all' | 'lost' | 'registered' | 'recovered'>('all')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [beaconLogs, setBeaconLogs] = useState<BeaconLog[]>([])
  const [showBeacons, setShowBeacons] = useState(true)

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey })

  useEffect(() => {
    if (loadError) {
      console.error('[LiveMap] Google Maps failed to load:', loadError)
    }
  }, [loadError])

  useEffect(() => {
    fetchBeaconLogs()
    const sub = db
      .channel('beacon-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', table: 'beacon_logs', schema: 'public' }, () => {
        fetchBeaconLogs()
      })
      .subscribe()
    return () => { void db.removeChannel(sub) }
  }, [])

  async function fetchBeaconLogs() {
    // Start from every lost/recovered device that already has a location.
    const { data: baseDevices } = await db
      .from('devices')
      .select('id, make, model, status, last_seen_lat, last_seen_lng, last_seen_at, serial_number')
      .in('status', ['lost', 'stolen', 'recovered', 'found'])
      .not('last_seen_lat', 'is', null)

    const logsMap = new Map()

    baseDevices?.forEach((d: any) => {
      logsMap.set(d.id, {
        id: `dev-${d.id}`,
        device_id: d.id,
        latitude: d.last_seen_lat,
        longitude: d.last_seen_lng,
        reported_at: d.last_seen_at,
        device_make: d.make,
        device_model: d.model,
        device_serial: d.serial_number,
      })
    })

    // Then overlay the actual mesh sightings, keeping the most recent per device.
    const { data: signals } = await db
      .from('beacon_logs')
      .select('id, device_id, latitude, longitude, reported_at, devices(make, model, serial_number)')
      .order('reported_at', { ascending: false })
      .limit(100)

    if (signals) {
      signals.forEach((log: any) => {
        const existing = logsMap.get(log.device_id)
        if (!existing || new Date(log.reported_at) > new Date(existing.reported_at)) {
          logsMap.set(log.device_id, {
            id: log.id,
            device_id: log.device_id,
            latitude: log.latitude,
            longitude: log.longitude,
            reported_at: log.reported_at,
            device_make: log.devices?.make,
            device_model: log.devices?.model,
            device_serial: log.devices?.serial_number,
          })
        }
      })
    }

    setBeaconLogs(Array.from(logsMap.values()))
  }

  const filteredDevices = devices.filter(d => {
    if (filter === 'all') return true
    if (filter === 'lost') return d.status === 'lost' || d.status === 'stolen'
    if (filter === 'registered') return d.status === 'registered'
    if (filter === 'recovered') return d.status === 'recovered' || d.status === 'found'
    return true
  })

  const lost = devices.filter(d => d.status === 'lost' || d.status === 'stolen').length
  const located = devices.filter(d => d.last_seen_lat != null).length
  const sightingsToday = beaconLogs.filter(l =>
    new Date(l.reported_at).toDateString() === new Date().toDateString()).length

  return (
    <Page>
      <PageHeader
        title="Live Map"
        subtitle="Where your devices were last seen, and what the Scout mesh has reported"
      />

      <div className="crm-c4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Devices Tracked" value={devices.length} icon={Smartphone} tone={TONE.blue} loading={loading} />
        <SummaryCard label="With a Location" value={located} icon={MapPin} tone={TONE.green} loading={loading} note={devices.length ? `of ${devices.length}` : undefined} />
        <SummaryCard label="Currently Lost" value={lost} icon={AlertTriangle} tone={lost ? TONE.red : TONE.grey} loading={loading} />
        <SummaryCard label="Sightings Today" value={sightingsToday} icon={Radio} tone={sightingsToday ? TONE.amber : TONE.grey} loading={loading} />
      </div>

      <Card style={{ padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: C.label }}>Show</span>
          <div style={{ display: 'flex', gap: '4px', background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '999px', padding: '3px' }}>
            {FILTERS.map(type => {
              const active = filter === type
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, fontFamily: FONT, textTransform: 'capitalize',
                    background: active ? C.card : 'transparent',
                    color: active ? C.primary : C.label,
                    border: `1px solid ${active ? C.tileBorder : 'transparent'}`,
                  }}
                >
                  {type}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setShowBeacons(!showBeacons)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '7px 13px', borderRadius: '999px', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, fontFamily: FONT,
              background: showBeacons ? 'rgba(5,150,105,.07)' : C.card,
              border: `1px solid ${showBeacons ? TONE.green : C.border}`,
              color: showBeacons ? TONE.green : C.label,
            }}
          >
            {showBeacons ? <Eye size={14} /> : <EyeOff size={14} />}
            Beacon sweeps
          </button>

          <span style={{ fontSize: '12px', color: C.muted, fontWeight: 500, marginLeft: 'auto' }}>
            {filteredDevices.length} shown
          </span>
        </div>
      </Card>

      <div
        className="crm-split"
        style={{
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: '20px',
          alignItems: 'stretch', height: 'calc(100vh - 340px)', minHeight: '480px',
        }}
      >
        <Card style={{ overflow: 'hidden', position: 'relative' }}>
          {loadError ? (
            <EmptyState
              icon={MapPin}
              title="Map could not load"
              body="Check that VITE_GOOGLE_MAPS_API_KEY is set and that the Maps JavaScript API is enabled for it."
            />
          ) : isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={{ lat: 20.5937, lng: 78.9629 }}
              zoom={5}
              options={{ styles: lightMapStyle, disableDefaultUI: true, zoomControl: true }}
            >
              {filteredDevices.map(device => (
                <Marker
                  key={device.id}
                  position={{ lat: device.last_seen_lat || 20, lng: device.last_seen_lng || 78 }}
                  onClick={() => setSelectedDevice(device)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: STATUS_COLOR[device.status] || TONE.blue,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                    scale: selectedDevice?.id === device.id ? 10 : 7,
                  }}
                />
              ))}

              {showBeacons && beaconLogs.map(log => (
                <Marker
                  key={log.id}
                  position={{ lat: log.latitude, lng: log.longitude }}
                  opacity={0.7}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: TONE.green,
                    fillOpacity: 0.45,
                    strokeColor: TONE.green,
                    strokeWeight: 1,
                    scale: 4,
                  }}
                />
              ))}

              {selectedDevice && (
                <InfoWindow
                  position={{ lat: selectedDevice.last_seen_lat || 20, lng: selectedDevice.last_seen_lng || 78 }}
                  onCloseClick={() => setSelectedDevice(null)}
                >
                  <div style={{ fontFamily: FONT, padding: '2px 4px', minWidth: '140px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#111216' }}>
                      {selectedDevice.make} {selectedDevice.model}
                    </div>
                    <div style={{
                      fontSize: '11px', fontWeight: 600, marginTop: '3px',
                      color: STATUS_COLOR[selectedDevice.status] || TONE.blue,
                    }}>
                      {STATUS_LABEL[selectedDevice.status] || selectedDevice.status}
                    </div>
                    {selectedDevice.last_seen_at && (
                      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                        Seen {new Date(selectedDevice.last_seen_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <Skeleton width="100%" height="100%" radius={16} />
            </div>
          )}

          {isLoaded && !loadError && (
            <div style={{
              position: 'absolute', bottom: '16px', left: '16px', zIndex: 1,
              display: 'flex', alignItems: 'center', gap: '14px',
              background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(8px)',
              border: `1px solid ${C.tileBorder}`, borderRadius: '12px',
              padding: '9px 14px', fontFamily: FONT,
            }}>
              {[
                { tone: TONE.green, label: 'Protected' },
                { tone: TONE.red, label: 'Lost' },
                { tone: TONE.amber, label: 'Recovered' },
              ].map(l => (
                <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#374151', fontWeight: 500 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.tone }} />
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CardHeader title="Recent Sightings" subtitle="Reported by nearby LOQIT devices" />
          <div style={{ flex: 1, overflowY: 'auto', borderTop: `1px solid ${C.border}` }}>
            {loading ? (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', gap: '11px' }}>
                    <Skeleton width={32} height={32} radius={10} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="55%" height={12} />
                      <Skeleton width="40%" height={10} style={{ marginTop: '6px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : beaconLogs.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="No sightings yet"
                body="When a LOQIT device passes near one of yours, the encrypted sighting shows up here."
              />
            ) : (
              beaconLogs.map((log, i) => {
                const device = devices.find(d => d.id === log.device_id)
                const active = selectedDevice?.id === log.device_id
                return (
                  <div
                    key={log.id}
                    className="crm-row"
                    onClick={() => setSelectedDevice(device || null)}
                    style={{
                      display: 'flex', gap: '11px', padding: '13px 20px', cursor: 'pointer',
                      borderBottom: i < beaconLogs.length - 1 ? `1px solid ${C.border}` : 'none',
                      background: active ? 'rgba(39,118,234,.05)' : undefined,
                    }}
                  >
                    <IconTile icon={MapPin} tone={device ? (STATUS_COLOR[device.status] || TONE.blue) : TONE.blue} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>
                          {log.device_make} {log.device_model}
                        </span>
                        {device && (
                          <Badge tone={STATUS_COLOR[device.status] || TONE.blue}>
                            {STATUS_LABEL[device.status] || device.status}
                          </Badge>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: C.label, marginTop: '3px', fontFamily: 'ui-monospace, monospace' }}>
                        {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                      </div>
                      <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                        {new Date(log.reported_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </Page>
  )
}
