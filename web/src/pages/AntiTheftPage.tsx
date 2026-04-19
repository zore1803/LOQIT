import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Colors } from '../lib/colors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

/* ─── Types ─────────────────────────────────────────── */
type Device = { id: string; make: string; model: string; status: string; serial_number: string }
type ProtectionSettings = {
  id?: string
  device_id: string
  is_enabled: boolean
  sim_watch: boolean
  motion_watch: boolean
  camera_capture: boolean
  ble_broadcast: boolean
  lock_message: string
  alert_phone: string
  enabled_at?: string
}
type TheftEvent = {
  id: string
  event_type: string
  event_data: Record<string, unknown>
  latitude: number | null
  longitude: number | null
  triggered_at: string
}

const DEFAULT_SETTINGS = (deviceId: string): ProtectionSettings => ({
  device_id: deviceId,
  is_enabled: false,
  sim_watch: true,
  motion_watch: true,
  camera_capture: false,
  ble_broadcast: true,
  lock_message: 'This device belongs to its rightful owner. Contact LOQIT to return it.',
  alert_phone: '',
})

/* ─── Stat Card ──────────────────────────────────────── */
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: Colors.surfaceContainer, borderRadius: '16px', padding: '20px 24px',
      border: `1px solid ${Colors.outlineVariant}`, display: 'flex', alignItems: 'center', gap: '16px',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: '12px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-icons" style={{ fontSize: '22px', color }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: Colors.onSurface }}>{value}</div>
        <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  )
}

/* ─── Toggle Setting Row ─────────────────────────────── */
function ToggleRow({ icon, label, desc, value, onChange, color = Colors.primary }: {
  icon: string; label: string; desc: string; value: boolean; onChange: (v: boolean) => void; color?: string
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 0', borderBottom: `1px solid ${Colors.outlineVariant}`,
    }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flex: 1 }}>
        <div style={{ width: 38, height: 38, borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-icons" style={{ fontSize: '20px', color }}>{icon}</span>
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: Colors.onSurface }}>{label}</div>
          <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, marginTop: '2px' }}>{desc}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 52, height: 28, borderRadius: '14px', border: 'none', cursor: 'pointer',
          background: value ? Colors.primary : Colors.outlineVariant,
          position: 'relative', transition: 'background 0.25s ease', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: '3px',
          left: value ? '27px' : '3px',
          width: 22, height: 22, borderRadius: '50%',
          background: '#fff', transition: 'left 0.25s ease',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }} />
      </button>
    </div>
  )
}

/* ─── Event Badge ────────────────────────────────────── */
function eventColor(type: string) {
  if (type === 'sim_change') return Colors.error
  if (type === 'motion_alert') return '#f59e0b'
  if (type === 'camera_capture') return Colors.secondary
  return Colors.primary
}
function eventIcon(type: string) {
  if (type === 'sim_change') return 'sim_card_alert'
  if (type === 'motion_alert') return 'vibration'
  if (type === 'camera_capture') return 'photo_camera'
  return 'security'
}
function eventLabel(type: string) {
  if (type === 'sim_change') return 'SIM Card Swapped'
  if (type === 'motion_alert') return 'Unusual Motion'
  if (type === 'camera_capture') return 'Intruder Photo Captured'
  return 'Manual Alert Triggered'
}

/* ─── Main Page ─────────────────────────────────────── */
export function AntiTheftPage() {
  const { user, profile } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [settings, setSettings] = useState<ProtectionSettings | null>(null)
  const [events, setEvents] = useState<TheftEvent[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showComplaint, setShowComplaint] = useState(false)
  const [complaintText, setComplaintText] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  /* Load user devices */
  useEffect(() => {
    if (!user) return
    supabase.from('devices').select('id,make,model,status,serial_number').eq('owner_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDevices(data)
          setSelectedDeviceId(data[0].id)
        }
      })
  }, [user])

  /* Load protection settings & events for selected device */
  const loadDevice = useCallback(async (deviceId: string) => {
    if (!deviceId) return
    setLoading(true)
    const [{ data: settingsData }, { data: eventsData }] = await Promise.all([
      supabase.from('protection_settings').select('*').eq('device_id', deviceId).maybeSingle(),
      supabase.from('anti_theft_events').select('*').eq('device_id', deviceId).order('triggered_at', { ascending: false }).limit(20),
    ])
    setSettings(settingsData ?? DEFAULT_SETTINGS(deviceId))
    setEvents(eventsData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { if (selectedDeviceId) loadDevice(selectedDeviceId) }, [selectedDeviceId, loadDevice])

  /* Realtime subscription for live tamper events */
  useEffect(() => {
    if (!selectedDeviceId) return
    const channel = supabase
      .channel(`anti_theft_${selectedDeviceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anti_theft_events', filter: `device_id=eq.${selectedDeviceId}` },
        (payload) => setEvents(prev => [payload.new as TheftEvent, ...prev])
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedDeviceId])

  /* Save settings */
  const saveSettings = async () => {
    if (!settings || !user) return
    setSaving(true)
    setSaveMsg(null)
    const payload = {
      ...settings,
      owner_id: user.id,
      enabled_at: settings.is_enabled ? (settings.enabled_at ?? new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = settings.id
      ? await supabase.from('protection_settings').update(payload).eq('id', settings.id)
      : await supabase.from('protection_settings').insert(payload)

    setSaveMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Protection settings saved!' })
    setSaving(false)
    if (!error) loadDevice(selectedDeviceId)
  }

  /* Generate police complaint */
  const generateComplaint = () => {
    const device = devices.find(d => d.id === selectedDeviceId)
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    const recentEvents = events.slice(0, 3).map(e =>
      `- ${eventLabel(e.event_type)} detected at ${new Date(e.triggered_at).toLocaleString('en-IN')}`
        + (e.latitude ? ` (GPS: ${e.latitude.toFixed(4)}, ${e.longitude?.toFixed(4)})` : '')
    ).join('\n') || '- No tamper events recorded.'

    const draft = `APPLICATION FOR THEFT COMPLAINT — LOQIT VERIFIED

To,
The Station House Officer,
[Police Station Name],
[City, State]

Subject: Complaint regarding theft/loss of mobile device — Verified via LOQIT

Respected Sir/Madam,

I, ${profile?.full_name || '[Owner Name]'}, am writing to formally report the theft/loss of my registered mobile device. The device has been enrolled on the LOQIT Platform (Next-Gen Phone Recovery Protocol) and all details are digitally verified.

DEVICE DETAILS (LOQIT-Verified):
  Make / Model    : ${device?.make ?? '[Make]'} ${device?.model ?? '[Model]'}
  Serial Number   : ${device?.serial_number ?? '[Serial Number]'}
  LOQIT Device ID : ${selectedDeviceId}
  Current Status  : ${device?.status?.toUpperCase() ?? 'UNKNOWN'}
  Reported On     : ${now} IST

ANTI-THEFT ALERTS (from LOQIT Tamper Log):
${recentEvents}

I request you to:
1. Register an FIR under relevant sections of the IPC.
2. Coordinate with telecom authorities to trace using the hardware serial number.
3. Reference the LOQIT Anti-Theft event log for digital evidence.

I am prepared to cooperate fully in the investigation and submit all LOQIT-verified data to the authorities upon request.

Yours faithfully,
${profile?.full_name || '[Owner Name]'}
Phone: ${profile?.phone_number || '[Phone Number]'}
LOQIT Account: ${user?.email || '[Email]'}
Date: ${now}`

    setComplaintText(draft)
    setShowComplaint(true)
  }

  const copyComplaint = () => {
    navigator.clipboard.writeText(complaintText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  /* Recovery prediction (heuristic) */
  const recoveryProbability = () => {
    const device = devices.find(d => d.id === selectedDeviceId)
    if (!device) return { score: 0, label: 'Unknown', color: Colors.outline }
    const recentEvents = events.filter(e => {
      const diff = Date.now() - new Date(e.triggered_at).getTime()
      return diff < 24 * 60 * 60 * 1000
    }).length
    const hasLocation = events.some(e => e.latitude)
    let score = 30
    if (settings?.is_enabled) score += 20
    if (hasLocation) score += 30
    if (recentEvents > 0) score += 10
    if (device.status === 'lost') score += 10
    score = Math.min(score, 95)
    const label = score > 70 ? 'High Recovery Probability' : score > 45 ? 'Moderate Probability' : 'Low Probability'
    const color = score > 70 ? Colors.secondary : score > 45 ? '#f59e0b' : Colors.error
    return { score, label, color }
  }

  const recovery = recoveryProbability()
  const activeDevice = devices.find(d => d.id === selectedDeviceId)

  if (devices.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: Colors.onSurfaceVariant }}>
        <span className="material-icons" style={{ fontSize: '64px', color: Colors.outline }}>shield</span>
        <h2 style={{ color: Colors.onSurface, marginTop: '16px' }}>No devices found</h2>
        <p>Register a device first to enable Anti-Theft Protection.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: '900px', margin: '0 auto', color: Colors.onSurface }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '14px', background: `${Colors.error}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-icons" style={{ fontSize: '26px', color: Colors.error }}>security</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900 }}>Anti-Theft Protection</h1>
            <p style={{ margin: 0, fontSize: '13px', color: Colors.onSurfaceVariant }}>Proactive tamper detection, BLE alerts, and police documentation</p>
          </div>
        </div>
      </motion.div>

      {/* Device selector */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ marginTop: '28px', marginBottom: '24px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: Colors.onSurfaceVariant, display: 'block', marginBottom: '8px' }}>Protected Device</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {devices.map(d => (
            <button key={d.id} onClick={() => setSelectedDeviceId(d.id)}
              style={{
                padding: '8px 18px', borderRadius: '12px', border: `2px solid ${selectedDeviceId === d.id ? Colors.primary : Colors.outlineVariant}`,
                background: selectedDeviceId === d.id ? `${Colors.primary}18` : Colors.surfaceContainer,
                color: selectedDeviceId === d.id ? Colors.primary : Colors.onSurfaceVariant,
                fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              }}
            >
              <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>smartphone</span>
              {d.make} {d.model}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: Colors.onSurfaceVariant }}>
          <span className="material-icons" style={{ fontSize: '36px', animation: 'spin 1s linear infinite', color: Colors.primary }}>sync</span>
        </div>
      ) : settings && (
        <>
          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            <StatCard icon="security" label="Protection Status" value={settings.is_enabled ? 'ACTIVE' : 'OFF'} color={settings.is_enabled ? Colors.secondary : Colors.outline} />
            <StatCard icon="warning" label="Tamper Events" value={events.length} color={events.length > 0 ? Colors.error : Colors.outline} />
            <StatCard icon="trending_up" label="Recovery Score" value={`${recovery.score}%`} color={recovery.color} />
          </motion.div>

          {/* Recovery probability banner */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{
              background: `${recovery.color}12`, border: `1px solid ${recovery.color}44`,
              borderRadius: '16px', padding: '18px 22px', marginBottom: '24px',
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
            <span className="material-icons" style={{ fontSize: '28px', color: recovery.color }}>
              {recovery.score > 70 ? 'my_location' : recovery.score > 45 ? 'location_searching' : 'location_disabled'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: recovery.color }}>{recovery.label}</div>
              <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, marginTop: '2px' }}>
                Based on Anti-Theft mode status, location pings, and recent tamper events. Last updated just now.
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: recovery.color }}>{recovery.score}%</div>
          </motion.div>

          {/* Settings card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            style={{ background: Colors.surfaceContainer, borderRadius: '20px', padding: '28px', border: `1px solid ${Colors.outlineVariant}`, marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Protection Settings</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: Colors.onSurfaceVariant }}>{activeDevice?.make} {activeDevice?.model}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                onClick={() => setSettings(s => s ? { ...s, is_enabled: !s.is_enabled } : s)}
                style={{
                  padding: '10px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '14px',
                  background: settings.is_enabled ? Colors.error : Colors.secondary,
                  color: settings.is_enabled ? '#fff' : Colors.background,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>{settings.is_enabled ? 'shield' : 'shield_off'}</span>
                {settings.is_enabled ? 'Protection ON' : 'Enable Protection'}
              </motion.button>
            </div>

            <ToggleRow icon="sim_card_alert" label="SIM Change Watch" desc="Auto-marks device as lost when SIM is swapped" value={settings.sim_watch} onChange={v => setSettings(s => s ? { ...s, sim_watch: v } : s)} color={Colors.error} />
            <ToggleRow icon="vibration" label="Motion Detection" desc="Detect unusual movement while device is idle" value={settings.motion_watch} onChange={v => setSettings(s => s ? { ...s, motion_watch: v } : s)} color='#f59e0b' />
            <ToggleRow icon="bluetooth" label="Silent BLE Broadcast" desc="Continue broadcasting BLE beacon in stealth mode" value={settings.ble_broadcast} onChange={v => setSettings(s => s ? { ...s, ble_broadcast: v } : s)} color={Colors.primary} />
            <ToggleRow icon="photo_camera" label="Intruder Camera Capture" desc="Silently capture front-camera photo on failed unlock" value={settings.camera_capture} onChange={v => setSettings(s => s ? { ...s, camera_capture: v } : s)} color={Colors.secondary} />

            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: Colors.onSurfaceVariant, display: 'block', marginBottom: '8px' }}>Lock Screen Message</label>
              <textarea
                value={settings.lock_message}
                onChange={e => setSettings(s => s ? { ...s, lock_message: e.target.value } : s)}
                rows={2}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', background: Colors.surfaceContainerHigh, border: `1px solid ${Colors.outlineVariant}`, color: Colors.onSurface, fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <AnimatePresence>
              {saveMsg && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                    background: saveMsg.type === 'ok' ? `${Colors.secondary}18` : `${Colors.error}18`,
                    color: saveMsg.type === 'ok' ? Colors.secondary : Colors.error,
                    border: `1px solid ${saveMsg.type === 'ok' ? Colors.secondary : Colors.error}44`,
                  }}>
                  <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>
                    {saveMsg.type === 'ok' ? 'check_circle' : 'error'}
                  </span>
                  {saveMsg.text}
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={saveSettings} disabled={saving}
                style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '15px', background: `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`, color: Colors.onPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
                <span className="material-icons" style={{ fontSize: '18px', animation: saving ? 'spin 1s linear infinite' : 'none' }}>{saving ? 'sync' : 'save'}</span>
                {saving ? 'Saving…' : 'Save Settings'}
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={generateComplaint}
                style={{ padding: '13px 20px', borderRadius: '12px', border: `1px solid ${Colors.outlineVariant}`, cursor: 'pointer', fontWeight: 700, fontSize: '14px', background: Colors.surfaceContainerHigh, color: Colors.onSurface, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>description</span>
                Draft Complaint
              </motion.button>
            </div>
          </motion.div>

          {/* Tamper Event Log */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            style={{ background: Colors.surfaceContainer, borderRadius: '20px', padding: '28px', border: `1px solid ${Colors.outlineVariant}` }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 800 }}>Tamper Event Log</h2>
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: Colors.onSurfaceVariant }}>
                <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline }}>check_shield</span>
                <p style={{ marginTop: '8px' }}>No tamper events recorded. Your device is secure.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {events.map(ev => (
                  <div key={ev.id} style={{
                    display: 'flex', gap: '14px', alignItems: 'flex-start',
                    padding: '14px 16px', borderRadius: '12px',
                    background: `${eventColor(ev.event_type)}0d`,
                    border: `1px solid ${eventColor(ev.event_type)}33`,
                  }}>
                    <span className="material-icons" style={{ fontSize: '22px', color: eventColor(ev.event_type), marginTop: '2px', flexShrink: 0 }}>{eventIcon(ev.event_type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: Colors.onSurface }}>{eventLabel(ev.event_type)}</div>
                      <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant, marginTop: '4px' }}>
                        {new Date(ev.triggered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        {ev.latitude && ` · GPS: ${ev.latitude.toFixed(4)}, ${ev.longitude?.toFixed(4)}`}
                      </div>
                      {ev.event_data && Object.keys(ev.event_data).length > 0 && (
                        <div style={{ fontSize: '11px', marginTop: '4px', color: Colors.onSurfaceVariant, fontFamily: 'monospace', background: Colors.surfaceContainerHigh, padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                          {JSON.stringify(ev.event_data)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Police Complaint Modal */}
      <AnimatePresence>
        {showComplaint && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={() => setShowComplaint(false)}
          >
            <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }}
              onClick={e => e.stopPropagation()}
              style={{ background: Colors.surfaceContainerLowest, borderRadius: '24px', padding: '32px', maxWidth: '680px', width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${Colors.outlineVariant}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-icons" style={{ color: Colors.primary }}>description</span>
                  Police Complaint Draft
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={copyComplaint}
                    style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', background: copied ? Colors.secondary : Colors.primary, color: copied ? Colors.background : Colors.onPrimary, display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s' }}>
                    <span className="material-icons" style={{ fontSize: '16px' }}>{copied ? 'check' : 'content_copy'}</span>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button onClick={() => setShowComplaint(false)}
                    style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${Colors.outlineVariant}`, cursor: 'pointer', background: 'none', color: Colors.onSurface }}>
                    <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={complaintText}
                style={{ flex: 1, padding: '16px', borderRadius: '12px', background: Colors.surfaceContainer, border: `1px solid ${Colors.outlineVariant}`, color: Colors.onSurface, fontSize: '13px', lineHeight: 1.7, fontFamily: 'monospace', resize: 'none', overflow: 'auto' }}
              />
              <p style={{ fontSize: '12px', color: Colors.onSurfaceVariant, marginTop: '12px', textAlign: 'center' }}>
                Copy this draft and submit it to your nearest police station. Fill in the bracketed fields before submission.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
