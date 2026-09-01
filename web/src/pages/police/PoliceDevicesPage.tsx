import { useEffect, useState } from 'react'
import {
  Smartphone, Search, SearchX, MapPin, ExternalLink, X, User, Phone,
  FileText, Banknote, Home, Clock, AlertTriangle,
} from 'lucide-react'
import { db } from '../../lib/db'
import {
  C, TONE, FONT, Page, PageHeader, Card, Button, Badge, Skeleton,
  EmptyState, SummaryCard, TableHead, td, tdMono, tdMuted, IconTile, inputStyle,
} from '../../components/crm'

type Device = {
  id: string
  imei_primary: string
  serial_number: string
  make: string
  model: string
  status: string
  last_seen_at: string | null
  last_seen_lat: number | null
  last_seen_lng: number | null
  owner_id: string
  profiles: Array<{
    full_name: string
    phone_number: string | null
  }> | null
  lost_reports: Array<{
    id: string
    reported_at: string
    police_complaint_number: string | null
    reward_amount: number | null
    last_known_address: string | null
  }>
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'lost', label: 'Lost' },
  { key: 'stolen', label: 'Stolen' },
] as const

type FilterKey = typeof FILTERS[number]['key']

export function PoliceDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)

  useEffect(() => {
    loadDevices()
  }, [filter])

  const loadDevices = async () => {
    setLoading(true)
    try {
      let query = db
        .from('devices')
        .select(`
          id,
          imei_primary,
          serial_number,
          make,
          model,
          status,
          last_seen_at,
          last_seen_lat,
          last_seen_lng,
          owner_id,
          profiles(full_name, phone_number),
          lost_reports(id, reported_at, police_complaint_number, reward_amount, last_known_address)
        `)

      if (filter === 'all') {
        query = query.in('status', ['lost', 'stolen'])
      } else {
        query = query.eq('status', filter)
      }

      const { data, error } = await query.order('last_seen_at', { ascending: false, nullsFirst: false })

      if (error) throw error
      setDevices(data as Device[])
    } catch (error) {
      console.error('Error loading devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDevices = devices.filter(device => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      device.serial_number.toLowerCase().includes(search) ||
      device.make.toLowerCase().includes(search) ||
      device.model.toLowerCase().includes(search) ||
      device.profiles?.[0]?.full_name?.toLowerCase().includes(search) ||
      device.lost_reports[0]?.police_complaint_number?.toLowerCase().includes(search)
    )
  })

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
  }

  const lostCount = devices.filter(d => d.status === 'lost').length
  const stolenCount = devices.filter(d => d.status === 'stolen').length
  const withLocation = devices.filter(d => d.last_seen_lat != null).length
  const withFir = devices.filter(d => d.lost_reports?.[0]?.police_complaint_number).length

  return (
    <Page>
      <PageHeader
        title="Lost Devices"
        subtitle="Every device reported lost or stolen across the network"
      />

      <div className="crm-c4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Reported Lost" value={lostCount} icon={Smartphone} tone={lostCount ? TONE.amber : TONE.grey} loading={loading} />
        <SummaryCard label="Reported Stolen" value={stolenCount} icon={AlertTriangle} tone={stolenCount ? TONE.red : TONE.grey} loading={loading} />
        <SummaryCard label="With a Location" value={withLocation} icon={MapPin} tone={TONE.green} loading={loading} note={devices.length ? `of ${devices.length}` : undefined} />
        <SummaryCard label="FIR Filed" value={withFir} icon={FileText} tone={TONE.blue} loading={loading} />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 0 }}>
            <Search size={15} color={C.muted} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="crm-input"
              placeholder="Search by serial, make, model, owner or FIR number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '34px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '999px', padding: '3px' }}>
            {FILTERS.map(f => {
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                    background: active ? C.card : 'transparent',
                    color: active ? C.primary : C.label,
                    border: `1px solid ${active ? C.tileBorder : 'transparent'}`,
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          <span style={{ fontSize: '12px', color: C.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {loading ? '—' : `${filteredDevices.length} of ${devices.length}`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width={34} height={34} radius={10} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="30%" height={13} />
                  <Skeleton width="18%" height={11} style={{ marginTop: '6px' }} />
                </div>
                <Skeleton width={72} height={22} radius={999} />
                <Skeleton width={100} height={13} />
              </div>
            ))}
          </div>
        ) : filteredDevices.length === 0 ? (
          searchQuery ? (
            <EmptyState
              icon={SearchX}
              title="Nothing matches that search"
              body="Try a serial number, make, model, owner name or FIR number."
              action={<Button variant="ghost" onClick={() => setSearchQuery('')}>Clear search</Button>}
            />
          ) : (
            <EmptyState
              icon={Smartphone}
              title="No devices reported"
              body="Devices marked lost or stolen by their owners show up here."
            />
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHead columns={['Device', 'Serial Number', 'Status', 'Owner', 'FIR Number', 'Last Seen', '']} />
              <tbody>
                {filteredDevices.map((device, i) => {
                  const report = device.lost_reports?.[0]
                  const owner = device.profiles?.[0]
                  const tone = device.status === 'stolen' ? TONE.red : TONE.amber
                  return (
                    <tr
                      key={device.id}
                      className="crm-row"
                      onClick={() => setSelectedDevice(device)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: i < filteredDevices.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: selectedDevice?.id === device.id ? C.tile : undefined,
                      }}
                    >
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IconTile icon={Smartphone} tone={tone} />
                          <span style={{ fontWeight: 600 }}>{device.make} {device.model}</span>
                        </div>
                      </td>
                      <td style={tdMono}>{device.serial_number}</td>
                      <td style={td}>
                        <Badge tone={tone}>{device.status === 'stolen' ? 'Stolen' : 'Lost'}</Badge>
                      </td>
                      <td style={tdMuted}>{owner?.full_name || '—'}</td>
                      <td style={{ ...tdMono, color: report?.police_complaint_number ? C.heading : C.muted }}>
                        {report?.police_complaint_number || '—'}
                      </td>
                      <td style={tdMuted}>
                        {device.last_seen_at
                          ? new Date(device.last_seen_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {device.last_seen_lat != null && device.last_seen_lng != null && (
                          <button
                            title="Open in Google Maps"
                            onClick={(e) => { e.stopPropagation(); openInMaps(device.last_seen_lat!, device.last_seen_lng!) }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '9px',
                              background: C.card, border: `1px solid ${C.border}`,
                              color: C.label, cursor: 'pointer',
                            }}
                          >
                            <MapPin size={15} strokeWidth={1.9} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Case detail panel */}
      {selectedDevice && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(17,18,22,.25)' }} onClick={() => setSelectedDevice(null)} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1000,
            width: '420px', maxWidth: '92vw', background: C.card,
            borderLeft: `1px solid ${C.tileBorder}`,
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
            boxShadow: '-8px 0 32px rgba(17,18,22,.10)', fontFamily: FONT,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: 0 }}>Case Details</h2>
              <button
                onClick={() => setSelectedDevice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', lineHeight: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <IconTile icon={Smartphone} tone={selectedDevice.status === 'stolen' ? TONE.red : TONE.amber} size={48} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: C.heading }}>
                    {selectedDevice.make} {selectedDevice.model}
                  </div>
                  <div style={{ marginTop: '5px' }}>
                    <Badge tone={selectedDevice.status === 'stolen' ? TONE.red : TONE.amber}>
                      {selectedDevice.status === 'stolen' ? 'Stolen' : 'Lost'}
                    </Badge>
                  </div>
                </div>
              </div>

              {[
                {
                  label: 'Device',
                  rows: [
                    { icon: Smartphone, label: 'Serial number', value: selectedDevice.serial_number, mono: true },
                    { icon: Clock, label: 'Last seen', value: selectedDevice.last_seen_at ? new Date(selectedDevice.last_seen_at).toLocaleString('en-IN') : 'Never' },
                  ],
                },
                {
                  label: 'Owner',
                  rows: [
                    { icon: User, label: 'Name', value: selectedDevice.profiles?.[0]?.full_name || '—' },
                    { icon: Phone, label: 'Phone', value: selectedDevice.profiles?.[0]?.phone_number || '—' },
                  ],
                },
                {
                  label: 'Report',
                  rows: [
                    { icon: FileText, label: 'FIR number', value: selectedDevice.lost_reports?.[0]?.police_complaint_number || 'Not filed', mono: true },
                    { icon: Clock, label: 'Reported at', value: selectedDevice.lost_reports?.[0]?.reported_at ? new Date(selectedDevice.lost_reports[0].reported_at).toLocaleString('en-IN') : '—' },
                    { icon: Banknote, label: 'Reward offered', value: selectedDevice.lost_reports?.[0]?.reward_amount ? `₹${selectedDevice.lost_reports[0].reward_amount.toLocaleString('en-IN')}` : '—' },
                    { icon: Home, label: 'Last known address', value: selectedDevice.lost_reports?.[0]?.last_known_address || '—' },
                  ],
                },
              ].map(section => (
                <div key={section.label} style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, color: C.label,
                    letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '8px',
                  }}>
                    {section.label}
                  </div>
                  <div style={{ background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
                    {section.rows.map((row, i) => (
                      <div key={row.label} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px',
                        borderBottom: i < section.rows.length - 1 ? `1px solid ${C.tileBorder}` : 'none',
                      }}>
                        <row.icon size={14} color={C.muted} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: C.label, flex: 1 }}>{row.label}</span>
                        <span style={{
                          fontSize: '12px', fontWeight: 500, color: C.heading, textAlign: 'right',
                          fontFamily: (row as any).mono ? 'ui-monospace, monospace' : 'inherit',
                          wordBreak: 'break-word', maxWidth: '55%',
                        }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {selectedDevice.last_seen_lat != null && selectedDevice.last_seen_lng != null && (
                <Button
                  full
                  icon={ExternalLink}
                  onClick={() => openInMaps(selectedDevice.last_seen_lat!, selectedDevice.last_seen_lng!)}
                >
                  Open last location in Maps
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </Page>
  )
}
