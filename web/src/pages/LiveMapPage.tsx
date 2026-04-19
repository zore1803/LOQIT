import { useEffect, useState, CSSProperties } from 'react'
import { Colors } from '../lib/colors'
import { useDevices, Device } from '../hooks/useDevices'
import { supabase } from '../lib/supabase'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'

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
  lost: '#FF4E4E',
  stolen: '#FF4E4E',
  recovered: '#ffb95f',
  found: '#ffb95f',
  registered: '#46f1bb',
}

const STATUS_LABEL: Record<string, string> = {
  lost: 'Lost',
  stolen: 'Stolen',
  recovered: 'Recovered',
  found: 'Found',
  registered: 'Protected',
}

const mapContainerStyle: CSSProperties = { width: '100%', height: '100%' }

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

export function LiveMapPage() {
  const { devices, loading } = useDevices()
  const [filter, setFilter] = useState<'all' | 'lost' | 'registered' | 'recovered'>('all')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [beaconLogs, setBeaconLogs] = useState<BeaconLog[]>([])
  const [showBeacons, setShowBeacons] = useState(true)

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
    fetchBeaconLogs()
    const sub = supabase
      .channel('beacon-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', table: 'beacon_logs', schema: 'public' }, () => {
        fetchBeaconLogs()
      })
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [])

  async function fetchBeaconLogs() {
    // 1. Fetch all devices marked as lost, stolen or recovered as a base
    const { data: baseDevices } = await supabase
      .from('devices')
      .select('id, make, model, status, last_seen_lat, last_seen_lng, last_seen_at, serial_number')
      .in('status', ['lost', 'stolen', 'recovered', 'found'])
      .not('last_seen_lat', 'is', null)

    const logsMap = new Map()

    // Initialize with device base location
    baseDevices?.forEach(d => {
      logsMap.set(d.id, {
        id: `dev-${d.id}`,
        device_id: d.id,
        latitude: d.last_seen_lat,
        longitude: d.last_seen_lng,
        reported_at: d.last_seen_at,
        device_make: d.make,
        device_model: d.model,
        device_serial: d.serial_number
      })
    })

    // 2. Fetch the actual detection logs (real-time signals)
    const { data: signals } = await supabase
      .from('beacon_logs')
      .select(`
        id, 
        device_id, 
        latitude, 
        longitude, 
        reported_at,
        devices(make, model, serial_number)
      `)
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
            device_serial: log.devices?.serial_number
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

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', background: Colors.background, minHeight: '100vh' }}>
        <span className="material-icons" style={{ color: Colors.primary, fontSize: '48px', animation: 'spin 1.5s linear infinite' }}>sync</span>
      </div>
    )
  }

  return (
    <div style={{
      padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', background: Colors.background, minHeight: '100vh',
      display: 'flex', flexDirection: 'column', gap: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ color: Colors.onSurface, fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>Global Tracking Grid</h1>
          <p style={{ color: Colors.onSurfaceVariant, fontSize: '14px' }}>Real-time spatial visualization of protected devices and crowd-sourced signal sweeps.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', background: Colors.surfaceContainer, padding: '4px', borderRadius: '12px' }}>
          {(['all', 'lost', 'registered', 'recovered'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                transition: 'all 0.2s', textTransform: 'capitalize',
                background: filter === type ? Colors.primary : 'transparent',
                color: filter === type ? Colors.onPrimary : Colors.onSurfaceVariant,
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '24px',
        height: 'calc(100vh - 200px)', minHeight: '500px'
      }}>
        <div style={{
          position: 'relative', background: Colors.surfaceContainerLowest, border: `1px solid ${Colors.outlineVariant}`,
          borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={{ lat: 20.5937, lng: 78.9629 }}
              zoom={5}
              options={{
                styles: darkMapStyle,
                disableDefaultUI: true,
                zoomControl: true,
              }}
            >
              {filteredDevices.map(device => (
                <Marker
                  key={device.id}
                  position={{ lat: device.last_seen_lat || 20, lng: device.last_seen_lng || 78 }}
                  onClick={() => setSelectedDevice(device)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: STATUS_COLOR[device.status] || Colors.primary,
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    scale: selectedDevice?.id === device.id ? 10 : 7,
                  }}
                />
              ))}

              {showBeacons && beaconLogs.map(log => (
                <Marker
                  key={log.id}
                  position={{ lat: log.latitude, lng: log.longitude }}
                  opacity={0.6}
                  icon={{
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    fillColor: Colors.secondary,
                    fillOpacity: 0.5,
                    strokeColor: Colors.secondary,
                    strokeWeight: 1,
                    scale: 3,
                  }}
                />
              ))}

              {selectedDevice && (
                <InfoWindow
                  position={{ lat: selectedDevice.last_seen_lat || 20, lng: selectedDevice.last_seen_lng || 78 }}
                  onCloseClick={() => setSelectedDevice(null)}
                >
                  <div style={{ color: '#000', padding: '6px' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '2px' }}>{selectedDevice.make} {selectedDevice.model}</div>
                    <div style={{ fontSize: '11px', color: STATUS_COLOR[selectedDevice.status], fontWeight: 700 }}>
                      {STATUS_LABEL[selectedDevice.status]}
                    </div>
                    {selectedDevice.last_seen_at && (
                       <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
                         Seen: {new Date(selectedDevice.last_seen_at).toLocaleString()}
                       </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <span className="material-icons" style={{ animation: 'spin 1.5s linear infinite', color: Colors.outline }}>sync</span>
            </div>
          )}

          <div style={{
            position: 'absolute', bottom: '24px', left: '24px', background: 'rgba(26,29,36,0.85)',
            backdropFilter: 'blur(8px)', padding: '12px 20px', borderRadius: '16px', border: `1px solid ${Colors.outlineVariant}`,
            display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: Colors.primary }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>{filteredDevices.length} Protected</span>
            </div>
            <div style={{ width: '1px', height: '16px', background: Colors.outlineVariant }} />
            <button
               onClick={() => setShowBeacons(!showBeacons)}
               style={{
                 background: 'transparent', border: 'none', color: showBeacons ? Colors.secondary : Colors.outline,
                 fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
               }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>{showBeacons ? 'visibility' : 'visibility_off'}</span>
              BEACON SWEEPS
            </button>
          </div>
        </div>

        <div style={{
          background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`,
          borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '20px', borderBottom: `1px solid ${Colors.outlineVariant}` }}>
             <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: Colors.onSurface }}>Recent Sightings</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {beaconLogs.map((log, i) => (
              <div
                key={log.id}
                onClick={() => setSelectedDevice(devices.find(d => d.id === log.device_id) || null)}
                style={{
                  padding: '16px', borderBottom: i < beaconLogs.length - 1 ? `1px solid ${Colors.outlineVariant}50` : 'none',
                  cursor: 'pointer', transition: 'background 0.2s',
                  background: selectedDevice?.id === log.device_id ? Colors.primary + '10' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: Colors.onSurface }}>{log.device_make} {log.device_model}</span>
                </div>
                <div style={{ fontSize: '10px', color: Colors.onSurfaceVariant, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-icons" style={{ fontSize: '12px' }}>place</span>
                  {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                </div>
                <div style={{ fontSize: '10px', color: Colors.outline, marginTop: '4px' }}>
                   {new Date(log.reported_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
