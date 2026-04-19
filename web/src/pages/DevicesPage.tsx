import { CSSProperties, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Colors } from '../lib/colors'
import { useDevices, Device } from '../hooks/useDevices'
import { Button } from '../components/Button'
import { motion, AnimatePresence } from 'framer-motion'

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
const STATUS_ICON: Record<string, string> = {
  lost: 'warning', stolen: 'warning',
  recovered: 'check_circle', found: 'check_circle',
  registered: 'verified',
}

export function DevicesPage() {
  const navigate = useNavigate()
  const { devices, loading, markAsLost, markAsFound, deleteDevice, remoteLockDevice } = useDevices()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'registered' | 'lost' | 'recovered'>('all')
  const [confirmRemoteLock, setConfirmRemoteLock] = useState<Device | null>(null)
  const [remoteLockSent, setRemoteLockSent] = useState<string | null>(null)

  const handleMarkLost = async (device: Device) => {
    setActionLoading(device.id)
    await markAsLost(device.id)
    setActionLoading(null)
    if (selectedDevice?.id === device.id) setSelectedDevice({ ...device, status: 'lost' })
  }

  const handleMarkFound = async (device: Device) => {
    setActionLoading(device.id)
    await markAsFound(device.id)
    setActionLoading(null)
    if (selectedDevice?.id === device.id) setSelectedDevice({ ...device, status: 'recovered' })
  }

  const handleDelete = async (id: string) => {
    setActionLoading(id)
    await deleteDevice(id)
    setActionLoading(null)
    setConfirmDelete(null)
    if (selectedDevice?.id === id) setSelectedDevice(null)
  }

  const handleRemoteLock = async (device: Device) => {
    setActionLoading(device.id)
    const { error } = await remoteLockDevice(device.id, `${device.make} ${device.model}`)
    setActionLoading(null)
    setConfirmRemoteLock(null)
    if (!error) setRemoteLockSent(device.id)
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

  const containerStyle: CSSProperties = { padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', height: '100%' }

  const modalOverlayStyle: CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  }

  if (loading && devices.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', opacity: 0.3 }}>
          <div style={{ height: '32px', width: '200px', background: Colors.outlineVariant, borderRadius: '8px' }} />
          <div style={{ height: '36px', width: '120px', background: Colors.outlineVariant, borderRadius: '12px' }} />
        </div>
        <div style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
           {[1,2,3,4,5].map(i => (
             <div key={i} style={{ height: '64px', background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`, borderRadius: '12px', opacity: 0.2, animation: 'pulse 2s infinite' }} />
           ))}
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: Colors.onSurface, margin: 0, letterSpacing: '-0.3px' }}>My Devices</h1>
          <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, margin: '4px 0 0' }}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <Button onClick={() => navigate('/add-device')} icon="add" size="small">Register Device</Button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <span className="material-icons" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: Colors.outline }}>search</span>
          <input
            placeholder="Search by name, serial, key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              backgroundColor: Colors.surfaceContainer,
              border: `1px solid ${Colors.outlineVariant}`,
              borderRadius: '8px', color: Colors.onSurface,
              fontSize: '14px', outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = Colors.primary }}
            onBlur={(e) => { e.currentTarget.style.borderColor = Colors.outlineVariant }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'registered', 'lost', 'recovered'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: '8px',
                border: `1px solid ${statusFilter === f ? Colors.primary : Colors.outlineVariant}`,
                backgroundColor: statusFilter === f ? `${Colors.primary}15` : 'transparent',
                color: statusFilter === f ? Colors.primary : Colors.onSurfaceVariant,
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f === 'registered' ? 'Protected' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`, borderRadius: '12px', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: Colors.onSurfaceVariant, display: 'block', marginBottom: '12px', opacity: 0.4 }}>
              {search || statusFilter !== 'all' ? 'search_off' : 'devices'}
            </span>
            <div style={{ fontSize: '16px', fontWeight: 600, color: Colors.onSurface, marginBottom: '8px' }}>
              {search || statusFilter !== 'all' ? 'No devices match your filter' : 'No devices yet'}
            </div>
            {!search && statusFilter === 'all' && (
              <>
                <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, marginBottom: '20px' }}>
                  Register your devices to start tracking and protecting them.
                </p>
                <Button size="small" icon="add_circle" onClick={() => navigate('/add-device')}>
                  Register First Device
                </Button>
              </>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: Colors.surfaceContainerHigh }}>
                {['Device', 'Serial Number', 'Status', 'LOQIT Key', 'Last Seen', 'Registered', ''].map((col) => (
                  <th key={col} style={{
                    padding: '11px 16px 11px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700, color: Colors.onSurfaceVariant,
                    textTransform: 'uppercase', letterSpacing: '0.6px',
                    borderBottom: `1px solid ${Colors.outlineVariant}`,
                    whiteSpace: 'nowrap',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const color = STATUS_COLOR[d.status] || Colors.primary
                const isLast = i === filtered.length - 1
                const isSelected = selectedDevice?.id === d.id
                return (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: isLast ? 'none' : `1px solid ${Colors.outlineVariant}`,
                      backgroundColor: isSelected ? `${Colors.primary}08` : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = Colors.surfaceContainerHigh }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {/* Device */}
                    <td style={{ padding: '13px 16px', cursor: 'pointer' }} onClick={() => setSelectedDevice(d)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: `${Colors.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="material-icons" style={{ fontSize: '18px', color: Colors.primary }}>smartphone</span>
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: Colors.onSurface }}>{d.make} {d.model}</div>
                          {d.color && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: d.color, border: `1px solid ${Colors.outline}` }} />
                              <span style={{ fontSize: '11px', color: Colors.onSurfaceVariant }}>{d.color}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* IMEI */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant, fontFamily: 'monospace' }}>{d.serial_number}</span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                        backgroundColor: `${color}15`, color,
                      }}>
                        <span className="material-icons" style={{ fontSize: '13px' }}>{STATUS_ICON[d.status] || 'help'}</span>
                        {STATUS_LABEL[d.status] || d.status}
                      </span>
                    </td>

                    {/* LOQIT Key */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: '13px', fontFamily: 'monospace', color: d.loqit_key ? Colors.primary : Colors.outline }}>
                        {d.loqit_key || '—'}
                      </span>
                    </td>

                    {/* Last Seen */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>
                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                    </td>

                    {/* Registered */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>
                        {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          title="View details"
                          onClick={() => setSelectedDevice(d)}
                          style={{ background: 'none', border: `1px solid ${Colors.outlineVariant}`, borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: Colors.onSurfaceVariant, lineHeight: 0, transition: 'all 0.1s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = Colors.primary; e.currentTarget.style.color = Colors.primary }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = Colors.outlineVariant; e.currentTarget.style.color = Colors.onSurfaceVariant }}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>info</span>
                        </button>

                        {d.status === 'lost' || d.status === 'stolen' ? (
                          <button
                            title="Mark as found"
                            onClick={() => handleMarkFound(d)}
                            disabled={actionLoading === d.id}
                            style={{ background: 'none', border: `1px solid ${Colors.secondary}`, borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: Colors.secondary, lineHeight: 0, opacity: actionLoading === d.id ? 0.5 : 1 }}
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                          </button>
                        ) : (
                          <button
                            title="Report as lost"
                            onClick={() => handleMarkLost(d)}
                            disabled={actionLoading === d.id}
                            style={{ background: 'none', border: `1px solid ${Colors.error}60`, borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: Colors.error, lineHeight: 0, opacity: actionLoading === d.id ? 0.5 : 1 }}
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>warning</span>
                          </button>
                        )}

                        <button
                          title="Delete device"
                          onClick={() => setConfirmDelete(d.id)}
                          style={{ background: 'none', border: `1px solid ${Colors.error}40`, borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: Colors.error, lineHeight: 0, transition: 'all 0.1s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${Colors.error}15` }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Slide-out Panel */}
      {selectedDevice && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 900, backgroundColor: 'transparent' }}
            onClick={() => setSelectedDevice(null)}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1000,
            width: '380px', backgroundColor: Colors.surfaceContainerLow,
            borderLeft: `1px solid ${Colors.outlineVariant}`,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
            overflowY: 'auto',
          }}>
            {/* Panel Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${Colors.outlineVariant}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Device Details</h2>
              <button
                onClick={() => setSelectedDevice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: Colors.onSurfaceVariant, padding: '4px', borderRadius: '6px' }}
              >
                <span className="material-icons" style={{ fontSize: '22px' }}>close</span>
              </button>
            </div>

            <div style={{ padding: '24px', flex: 1 }}>
              {/* Device Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: `${Colors.primary}15`, border: `2px solid ${Colors.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-icons" style={{ fontSize: '28px', color: Colors.primary }}>smartphone</span>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: Colors.onSurface }}>{selectedDevice.make} {selectedDevice.model}</div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, marginTop: '4px',
                    backgroundColor: `${STATUS_COLOR[selectedDevice.status] || Colors.primary}15`,
                    color: STATUS_COLOR[selectedDevice.status] || Colors.primary,
                  }}>
                    <span className="material-icons" style={{ fontSize: '13px' }}>{STATUS_ICON[selectedDevice.status] || 'help'}</span>
                    {STATUS_LABEL[selectedDevice.status] || selectedDevice.status}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div style={{ backgroundColor: Colors.surfaceContainer, borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                {[
                  { label: 'LOQIT Key', value: selectedDevice.loqit_key || '—', mono: true, color: selectedDevice.loqit_key ? Colors.primary : undefined },
                  { label: 'Serial Number', value: selectedDevice.serial_number, mono: true },
                  { label: 'BLE Hardware ID', value: selectedDevice.ble_device_uuid || '—', mono: true },
                  { label: 'State / Region', value: selectedDevice.state || '—' },
                  { label: 'Color', value: selectedDevice.color || '—' },
                  { label: 'Purchase Date', value: selectedDevice.purchase_date ? new Date(selectedDevice.purchase_date).toLocaleDateString('en-IN') : '—' },
                  { label: 'BLE Active', value: selectedDevice.is_ble_active ? 'Yes' : 'No' },
                  { label: 'Last Seen', value: selectedDevice.last_seen_at ? new Date(selectedDevice.last_seen_at).toLocaleString('en-IN') : 'Never' },
                  { label: 'Registered', value: new Date(selectedDevice.created_at).toLocaleString('en-IN') },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '11px 14px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${Colors.outlineVariant}` : 'none',
                  }}>
                    <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>{row.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: row.color || Colors.onSurface, fontFamily: row.mono ? 'monospace' : 'inherit', maxWidth: '200px', textAlign: 'right', wordBreak: 'break-all' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedDevice.status === 'lost' || selectedDevice.status === 'stolen' ? (
                  <Button variant="secondary" fullWidth icon="check_circle"
                    onClick={() => handleMarkFound(selectedDevice)}
                    loading={actionLoading === selectedDevice.id}>
                    Mark as Found
                  </Button>
                ) : (
                  <Button variant="danger" fullWidth icon="warning"
                    onClick={() => handleMarkLost(selectedDevice)}
                    loading={actionLoading === selectedDevice.id}>
                    Report as Lost
                  </Button>
                )}

                {/* Remote Lock Button */}
                <AnimatePresence mode="wait">
                  {remoteLockSent === selectedDevice.id ? (
                    <motion.div
                      key="sent"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 16px', borderRadius: '10px',
                        backgroundColor: '#10b98118', border: '1px solid #10b98140',
                        color: '#10b981', fontSize: '14px', fontWeight: 600,
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
                      Lock command sent to device
                    </motion.div>
                  ) : (
                    <motion.button
                      key="btn"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setConfirmRemoteLock(selectedDevice)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px', borderRadius: '10px', border: `1px solid #f59e0b60`,
                        backgroundColor: '#f59e0b10', color: '#f59e0b',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        width: '100%', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f59e0b20' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f59e0b10' }}
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>lock</span>
                      Remote Lock
                    </motion.button>
                  )}
                </AnimatePresence>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Button variant="outline" icon="history" onClick={() => navigate(`/devices/${selectedDevice.id}/history`)}>
                    History
                  </Button>
                  <Button variant="outline" icon="swap_horiz" onClick={() => navigate('/transfer-ownership')}>
                    Transfer
                  </Button>
                </div>
                <Button variant="ghost" icon="delete" style={{ color: Colors.error, border: `1px solid ${Colors.error}40` }}
                  onClick={() => { setSelectedDevice(null); setConfirmDelete(selectedDevice.id) }}>
                  Delete Device
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Remote Lock Confirmation Modal */}
      <AnimatePresence>
        {confirmRemoteLock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={modalOverlayStyle}
            onClick={() => setConfirmRemoteLock(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 20 }}
              style={{
                backgroundColor: Colors.surfaceContainer, borderRadius: '16px',
                padding: '28px', maxWidth: '420px', width: '90%',
                border: `1px solid ${Colors.outlineVariant}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #0a0a1a 0%, #0f1f3d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-icons" style={{ color: '#3D8EFF', fontSize: '24px' }}>lock</span>
                </div>
                <div>
                  <h3 style={{ color: Colors.onSurface, fontSize: '18px', fontWeight: 700, margin: 0 }}>Remote Lock</h3>
                  <p style={{ color: Colors.onSurfaceVariant, fontSize: '13px', margin: '2px 0 0' }}>
                    {confirmRemoteLock.make} {confirmRemoteLock.model}
                  </p>
                </div>
              </div>

              <div style={{ background: '#3D8EFF12', border: '1px solid #3D8EFF30', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
                <p style={{ color: Colors.onSurface, fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  This will instantly display a <strong>PIN lock screen</strong> on the device — even if it is not yet marked as lost. The thief will see the LOQIT lock screen and cannot use the phone without your passkey.
                </p>
              </div>

              <p style={{ color: Colors.onSurfaceVariant, fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
                The device must be online and have the LOQIT app running. Your passkey must already be set on that device for the lock screen to appear.
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="outline" onClick={() => setConfirmRemoteLock(null)} size="small">Cancel</Button>
                <button
                  onClick={() => handleRemoteLock(confirmRemoteLock)}
                  disabled={actionLoading === confirmRemoteLock.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 18px', borderRadius: '9px',
                    background: 'linear-gradient(135deg, #1a2a4a 0%, #3D8EFF 100%)',
                    border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700,
                    cursor: actionLoading === confirmRemoteLock.id ? 'not-allowed' : 'pointer',
                    opacity: actionLoading === confirmRemoteLock.id ? 0.6 : 1,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>
                    {actionLoading === confirmRemoteLock.id ? 'sync' : 'lock'}
                  </span>
                  {actionLoading === confirmRemoteLock.id ? 'Sending...' : 'Lock Now'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={modalOverlayStyle} onClick={() => setConfirmDelete(null)}>
          <div style={{
            backgroundColor: Colors.surfaceContainer, borderRadius: '14px',
            padding: '28px', maxWidth: '400px', width: '90%',
            border: `1px solid ${Colors.outlineVariant}`,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${Colors.error}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-icons" style={{ color: Colors.error }}>delete</span>
              </div>
              <h3 style={{ color: Colors.onSurface, fontSize: '18px', fontWeight: 700, margin: 0 }}>Delete Device?</h3>
            </div>
            <p style={{ color: Colors.onSurfaceVariant, marginBottom: '24px', fontSize: '14px', lineHeight: 1.6 }}>
              This will permanently remove the device from your account. All associated history and data will be lost. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setConfirmDelete(null)} size="small">Cancel</Button>
              <Button variant="danger" size="small"
                onClick={() => handleDelete(confirmDelete)}
                loading={actionLoading === confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
