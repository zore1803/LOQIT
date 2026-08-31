import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Smartphone, Search, PlusCircle, Info, CheckCircle2, AlertTriangle, Trash2,
  Lock, History, ArrowLeftRight, X, ShieldCheck, SearchX, Loader2,
} from 'lucide-react'
import { useDevices, Device } from '../hooks/useDevices'
import {
  C, TONE, FONT, Page, PageHeader, Card, Button, Badge, EmptyState, ErrorState,
  Skeleton, SummaryCard, TableHead, td, tdMono, tdMuted, IconTile, inputStyle, cardStyle,
} from '../components/crm'

const STATUS_TONE: Record<string, string> = {
  lost: TONE.red, stolen: TONE.red,
  recovered: TONE.amber, found: TONE.amber,
  registered: TONE.green,
}
const STATUS_LABEL: Record<string, string> = {
  lost: 'Lost', stolen: 'Stolen',
  recovered: 'Recovered', found: 'Found',
  registered: 'Protected',
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'registered', label: 'Protected' },
  { key: 'lost', label: 'Lost' },
  { key: 'recovered', label: 'Recovered' },
] as const

type FilterKey = typeof FILTERS[number]['key']

export function DevicesPage() {
  const navigate = useNavigate()
  const { devices, loading, error, refetch, markAsLost, markAsFound, deleteDevice, remoteLockDevice } = useDevices()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all')
  const [confirmRemoteLock, setConfirmRemoteLock] = useState<Device | null>(null)
  const [remoteLockSent, setRemoteLockSent] = useState<string | null>(null)

  const handleMarkLost = async (device: Device) => {
    setActionLoading(device.id)
    await markAsLost(device.id)
    setActionLoading(null)
    setSelectedDevice(null)
  }

  const handleMarkFound = async (device: Device) => {
    setActionLoading(device.id)
    await markAsFound(device.id)
    setActionLoading(null)
    setSelectedDevice(null)
  }

  const handleDelete = async (id: string) => {
    setActionLoading(id)
    await deleteDevice(id)
    setActionLoading(null)
    setConfirmDelete(null)
    setSelectedDevice(null)
  }

  const handleRemoteLock = async (device: Device) => {
    setActionLoading(device.id)
    const { error: lockError } = await remoteLockDevice(device.id, `${device.make} ${device.model}`)
    setActionLoading(null)
    setConfirmRemoteLock(null)
    if (!lockError) setRemoteLockSent(device.id)
  }

  const filtered = devices.filter((d) => {
    const matchSearch = !search
      || `${d.make} ${d.model} ${d.serial_number} ${d.loqit_key || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      statusFilter === 'all' ? true
        : statusFilter === 'lost' ? (d.status === 'lost' || d.status === 'stolen')
          : statusFilter === 'recovered' ? (d.status === 'recovered' || d.status === 'found')
            : d.status === 'registered'
    return matchSearch && matchStatus
  })

  const total = devices.length
  const safe = devices.filter(d => d.status === 'registered').length
  const lost = devices.filter(d => d.status === 'lost' || d.status === 'stolen').length
  const recovered = devices.filter(d => d.status === 'recovered' || d.status === 'found').length

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1100,
    background: 'rgba(17,18,22,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', fontFamily: FONT,
  }

  return (
    <Page>
      <PageHeader
        title="Devices"
        subtitle="Every device registered to your LOQIT account"
        actions={<Button onClick={() => navigate('/add-device')} icon={PlusCircle}>Register Device</Button>}
      />

      {/* Summary */}
      <div className="crm-c4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Total Devices" value={total} icon={Smartphone} tone={TONE.blue} loading={loading} />
        <SummaryCard label="Protected" value={safe} icon={ShieldCheck} tone={TONE.green} loading={loading} note={total ? `${Math.round((safe / total) * 100)}% of fleet` : undefined} />
        <SummaryCard label="Lost or Stolen" value={lost} icon={AlertTriangle} tone={lost ? TONE.red : TONE.grey} loading={loading} note={lost ? 'needs attention' : 'all clear'} />
        <SummaryCard label="Recovered" value={recovered} icon={CheckCircle2} tone={TONE.amber} loading={loading} />
      </div>

      {/* Toolbar + table */}
      <Card>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px', flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
            <Search size={15} color={C.muted} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="crm-input"
              placeholder="Search by make, model, serial or LOQIT key"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '34px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '999px', padding: '3px' }}>
            {FILTERS.map(f => {
              const active = statusFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                    background: active ? C.card : 'transparent',
                    color: active ? C.primary : C.label,
                    border: `1px solid ${active ? C.tileBorder : 'transparent'}`,
                    transition: 'background .15s ease',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          <span style={{ fontSize: '12px', color: C.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {loading ? '—' : `${filtered.length} of ${total}`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width={34} height={34} radius={10} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="34%" height={13} />
                  <Skeleton width="18%" height={11} style={{ marginTop: '6px' }} />
                </div>
                <Skeleton width={80} height={22} radius={999} />
                <Skeleton width={110} height={13} />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          search || statusFilter !== 'all' ? (
            <EmptyState
              icon={SearchX}
              title="No devices match your filter"
              body="Try a different search term, or clear the status filter."
              action={<Button variant="ghost" onClick={() => { setSearch(''); setStatusFilter('all') }}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={Smartphone}
              title="No devices yet"
              body="Register a device to start protecting it with LOQIT."
              action={<Button onClick={() => navigate('/add-device')} icon={PlusCircle}>Register Device</Button>}
            />
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHead columns={['Device', 'Serial Number', 'Status', 'LOQIT Key', 'Last Seen', 'Registered', '']} />
              <tbody>
                {filtered.map((d, i) => {
                  const tone = STATUS_TONE[d.status] || TONE.blue
                  const busy = actionLoading === d.id
                  const isLost = d.status === 'lost' || d.status === 'stolen'
                  return (
                    <tr
                      key={d.id}
                      className="crm-row"
                      style={{
                        borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: selectedDevice?.id === d.id ? C.tile : undefined,
                      }}
                    >
                      <td style={{ ...td, cursor: 'pointer' }} onClick={() => setSelectedDevice(d)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <IconTile icon={Smartphone} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{d.make} {d.model}</div>
                            {d.color && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: d.color, border: `1px solid ${C.tileBorder}` }} />
                                <span style={{ fontSize: '11px', color: C.muted }}>{d.color}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={tdMono}>{d.serial_number || '—'}</td>
                      <td style={td}><Badge tone={tone}>{STATUS_LABEL[d.status] || d.status}</Badge></td>
                      <td style={{ ...tdMono, color: d.loqit_key ? C.primary : C.muted }}>{d.loqit_key || '—'}</td>
                      <td style={tdMuted}>
                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td style={tdMuted}>
                        {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <IconButton title="View details" icon={Info} onClick={() => setSelectedDevice(d)} />
                          {isLost
                            ? <IconButton title="Mark as found" icon={busy ? Loader2 : CheckCircle2} tone={TONE.green} onClick={() => handleMarkFound(d)} disabled={busy} />
                            : <IconButton title="Report as lost" icon={busy ? Loader2 : AlertTriangle} tone={TONE.red} onClick={() => handleMarkLost(d)} disabled={busy} />}
                          <IconButton title="Delete device" icon={Trash2} tone={TONE.red} onClick={() => setConfirmDelete(d.id)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail panel */}
      {selectedDevice && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(17,18,22,.25)' }} onClick={() => setSelectedDevice(null)} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1000,
            width: '400px', maxWidth: '92vw', background: C.card,
            borderLeft: `1px solid ${C.tileBorder}`,
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
            boxShadow: '-8px 0 32px rgba(17,18,22,.10)', fontFamily: FONT,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: 0 }}>Device Details</h2>
              <button
                onClick={() => setSelectedDevice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', lineHeight: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <IconTile icon={Smartphone} size={48} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: C.heading }}>
                    {selectedDevice.make} {selectedDevice.model}
                  </div>
                  <div style={{ marginTop: '5px' }}>
                    <Badge tone={STATUS_TONE[selectedDevice.status] || TONE.blue}>
                      {STATUS_LABEL[selectedDevice.status] || selectedDevice.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div style={{ background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '18px' }}>
                {[
                  { label: 'LOQIT Key', value: selectedDevice.loqit_key || '—', mono: true, accent: !!selectedDevice.loqit_key },
                  { label: 'Serial Number', value: selectedDevice.serial_number, mono: true },
                  { label: 'BLE Hardware ID', value: selectedDevice.ble_device_uuid || '—', mono: true },
                  { label: 'State / Region', value: selectedDevice.state || '—' },
                  { label: 'Colour', value: selectedDevice.color || '—' },
                  { label: 'Purchase Date', value: selectedDevice.purchase_date ? new Date(selectedDevice.purchase_date).toLocaleDateString('en-IN') : '—' },
                  { label: 'BLE Active', value: selectedDevice.is_ble_active ? 'Yes' : 'No' },
                  { label: 'Last Seen', value: selectedDevice.last_seen_at ? new Date(selectedDevice.last_seen_at).toLocaleString('en-IN') : 'Never' },
                  { label: 'Registered', value: new Date(selectedDevice.created_at).toLocaleString('en-IN') },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                    padding: '10px 14px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${C.tileBorder}` : 'none',
                  }}>
                    <span style={{ fontSize: '12px', color: C.label, flexShrink: 0 }}>{row.label}</span>
                    <span style={{
                      fontSize: '12px', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all',
                      color: row.accent ? C.primary : C.heading,
                      fontFamily: row.mono ? 'ui-monospace, monospace' : 'inherit',
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedDevice.status === 'lost' || selectedDevice.status === 'stolen' ? (
                  <Button full icon={CheckCircle2} tone={TONE.green}
                    onClick={() => handleMarkFound(selectedDevice)}
                    disabled={actionLoading === selectedDevice.id}>
                    Mark as Found
                  </Button>
                ) : (
                  <Button full variant="danger" icon={AlertTriangle}
                    onClick={() => handleMarkLost(selectedDevice)}
                    disabled={actionLoading === selectedDevice.id}>
                    Report as Lost
                  </Button>
                )}

                {remoteLockSent === selectedDevice.id ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '11px 14px', borderRadius: '12px',
                    background: '#ECFDF5', border: '1px solid #A7F3D0',
                    color: TONE.green, fontSize: '13px', fontWeight: 600,
                  }}>
                    <CheckCircle2 size={16} /> Lock command sent to device
                  </div>
                ) : (
                  <Button full variant="ghost" icon={Lock} onClick={() => setConfirmRemoteLock(selectedDevice)}>
                    Remote Lock
                  </Button>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Button variant="ghost" icon={History} onClick={() => navigate(`/devices/${selectedDevice.id}/history`)}>History</Button>
                  <Button variant="ghost" icon={ArrowLeftRight} onClick={() => navigate('/transfer-ownership')}>Transfer</Button>
                </div>

                <button
                  onClick={() => { const id = selectedDevice.id; setSelectedDevice(null); setConfirmDelete(id) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '9px 14px', borderRadius: '12px', width: '100%',
                    background: C.card, border: `1px solid #FECACA`, color: TONE.red,
                    fontSize: '13px', fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                  }}
                >
                  <Trash2 size={15} /> Delete Device
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Remote lock confirmation */}
      {confirmRemoteLock && (
        <div style={modalOverlay} onClick={() => setConfirmRemoteLock(null)}>
          <div style={{ ...cardStyle, padding: '26px', maxWidth: '440px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <IconTile icon={Lock} size={44} />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: 0 }}>Remote Lock</h3>
                <p style={{ fontSize: '13px', color: C.muted, margin: '2px 0 0' }}>
                  {confirmRemoteLock.make} {confirmRemoteLock.model}
                </p>
              </div>
            </div>

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#1E40AF', margin: 0 }}>
                This immediately shows a <strong>PIN lock screen</strong> on the device, even if it is not marked as lost. It cannot be used without your passkey.
              </p>
            </div>

            <p style={{ fontSize: '12px', color: C.muted, lineHeight: 1.6, margin: '0 0 20px' }}>
              The device must be online with the LOQIT app running, and your passkey must already be set on it.
            </p>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setConfirmRemoteLock(null)}>Cancel</Button>
              <Button icon={Lock} onClick={() => handleRemoteLock(confirmRemoteLock)} disabled={actionLoading === confirmRemoteLock.id}>
                {actionLoading === confirmRemoteLock.id ? 'Sending…' : 'Lock Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...cardStyle, padding: '26px', maxWidth: '420px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <IconTile icon={Trash2} tone={TONE.red} size={44} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: 0 }}>Delete this device?</h3>
            </div>
            <p style={{ fontSize: '13px', color: C.label, lineHeight: 1.6, margin: '0 0 20px' }}>
              This permanently removes the device from your account, along with its history. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" icon={Trash2} onClick={() => handleDelete(confirmDelete)} disabled={actionLoading === confirmDelete}>
                {actionLoading === confirmDelete ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}

/** Small square icon action used in the table's trailing column. */
function IconButton({ icon: Icon, title, onClick, tone, disabled }: {
  icon: any; title: string; onClick: () => void; tone?: string; disabled?: boolean
}) {
  const [hover, setHover] = useState(false)
  const accent = tone || C.label
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '30px', height: '30px', borderRadius: '9px',
        background: hover && !disabled ? `${accent}12` : C.card,
        border: `1px solid ${hover && !disabled ? `${accent}44` : C.border}`,
        color: accent, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all .15s ease',
      }}
    >
      <Icon size={15} strokeWidth={1.9} />
    </button>
  )
}
