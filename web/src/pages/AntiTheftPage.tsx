import { useState, useEffect, useCallback } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, CreditCard, Vibrate, Bluetooth, Camera,
  FileText, Copy, Check, X, Smartphone, Activity, MapPin, AlertCircle,
  TrendingUp, Save,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { db } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import {
  C, TONE, FONT, Page, PageHeader, Card, CardHeader, Button,
  SummaryCard, EmptyState, Skeleton, IconTile, inputStyle, cardStyle, Field,
} from '../components/crm'

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

function eventMeta(type: string): { icon: LucideIcon; tone: string; label: string } {
  if (type === 'sim_change') return { icon: CreditCard, tone: TONE.red, label: 'SIM card swapped' }
  if (type === 'motion_alert') return { icon: Vibrate, tone: TONE.amber, label: 'Unusual motion' }
  if (type === 'camera_capture') return { icon: Camera, tone: TONE.green, label: 'Intruder photo captured' }
  return { icon: Shield, tone: TONE.blue, label: 'Manual alert triggered' }
}

/** CRM-style switch. */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: '42px', height: '24px', borderRadius: '999px', border: 'none',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        background: value ? C.primary : C.tileBorder,
        transition: 'background .2s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: value ? '21px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
        transition: 'left .2s ease', boxShadow: '0 1px 3px rgba(17,18,22,.25)',
      }} />
    </button>
  )
}

function ToggleRow({ icon: Icon, label, desc, value, onChange, tone = TONE.blue, last }: {
  icon: LucideIcon; label: string; desc: string; value: boolean
  onChange: (v: boolean) => void; tone?: string; last?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${C.border}`,
    }}>
      <IconTile icon={Icon} tone={tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{label}</div>
        <div style={{ fontSize: '12px', color: C.muted, marginTop: '1px' }}>{desc}</div>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

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
  const [devicesLoading, setDevicesLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    db.from('devices').select('id,make,model,status,serial_number').eq('owner_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDevices(data)
          setSelectedDeviceId(data[0].id)
        }
        setDevicesLoading(false)
      })
  }, [user])

  const loadDevice = useCallback(async (deviceId: string) => {
    if (!deviceId) return
    setLoading(true)
    const [{ data: settingsData }, { data: eventsData }] = await Promise.all([
      db.from('protection_settings').select('*').eq('device_id', deviceId).maybeSingle(),
      db.from('anti_theft_events').select('*').eq('device_id', deviceId).order('triggered_at', { ascending: false }).limit(20),
    ])
    setSettings(settingsData ?? DEFAULT_SETTINGS(deviceId))
    setEvents(eventsData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { if (selectedDeviceId) loadDevice(selectedDeviceId) }, [selectedDeviceId, loadDevice])

  useEffect(() => {
    if (!selectedDeviceId) return
    const channel = db
      .channel(`anti_theft_${selectedDeviceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anti_theft_events', filter: `device_id=eq.${selectedDeviceId}` },
        (payload) => setEvents(prev => [payload.new as TheftEvent, ...prev])
      )
      .subscribe()
    return () => { db.removeChannel(channel) }
  }, [selectedDeviceId])

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
      ? await db.from('protection_settings').update(payload).eq('id', settings.id)
      : await db.from('protection_settings').insert(payload)

    setSaveMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Protection settings saved.' })
    setSaving(false)
    if (!error) loadDevice(selectedDeviceId)
  }

  const generateComplaint = () => {
    const device = devices.find(d => d.id === selectedDeviceId)
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    const recentEvents = events.slice(0, 3).map(e =>
      `- ${eventMeta(e.event_type).label} detected at ${new Date(e.triggered_at).toLocaleString('en-IN')}`
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

  const recoveryProbability = () => {
    const device = devices.find(d => d.id === selectedDeviceId)
    if (!device) return { score: 0, label: 'Unknown', tone: TONE.grey }
    const recentEvents = events.filter(e =>
      Date.now() - new Date(e.triggered_at).getTime() < 24 * 60 * 60 * 1000).length
    const hasLocation = events.some(e => e.latitude)
    let score = 30
    if (settings?.is_enabled) score += 20
    if (hasLocation) score += 30
    if (recentEvents > 0) score += 10
    if (device.status === 'lost') score += 10
    score = Math.min(score, 95)
    const label = score > 70 ? 'High' : score > 45 ? 'Moderate' : 'Low'
    const tone = score > 70 ? TONE.green : score > 45 ? TONE.amber : TONE.red
    return { score, label, tone }
  }

  const recovery = recoveryProbability()
  const activeDevice = devices.find(d => d.id === selectedDeviceId)
  const eventsToday = events.filter(e =>
    new Date(e.triggered_at).toDateString() === new Date().toDateString()).length

  if (devicesLoading) {
    return (
      <Page>
        <PageHeader title="Anti-Theft" subtitle="Hardware protection and tamper monitoring" />
        <Card style={{ padding: '24px' }}>
          <Skeleton width="30%" height={16} />
          <Skeleton width="60%" height={12} style={{ marginTop: '10px' }} />
        </Card>
      </Page>
    )
  }

  if (devices.length === 0) {
    return (
      <Page>
        <PageHeader title="Anti-Theft" subtitle="Hardware protection and tamper monitoring" />
        <Card>
          <EmptyState
            icon={Smartphone}
            title="No devices to protect yet"
            body="Register a device first — anti-theft settings apply per device."
          />
        </Card>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Anti-Theft"
        subtitle="Hardware protection and tamper monitoring for each device"
        actions={<Button variant="ghost" icon={FileText} onClick={generateComplaint}>Draft police complaint</Button>}
      />

      {/* Device selector */}
      <Card style={{ padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: C.label, marginRight: '2px' }}>Device</span>
          {devices.map(d => {
            const active = d.id === selectedDeviceId
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDeviceId(d.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '7px 13px', borderRadius: '999px', cursor: 'pointer',
                  fontSize: '12.5px', fontWeight: active ? 600 : 500, fontFamily: FONT,
                  background: active ? 'rgba(39,118,234,.06)' : C.card,
                  border: `1px solid ${active ? C.primary : C.border}`,
                  color: active ? C.primary : C.label,
                  transition: 'all .15s ease',
                }}
              >
                <Smartphone size={14} />
                {d.make} {d.model}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Summary */}
      <div className="crm-c4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard
          label="Protection"
          value={settings?.is_enabled ? 'Active' : 'Off'}
          icon={settings?.is_enabled ? ShieldCheck : ShieldAlert}
          tone={settings?.is_enabled ? TONE.green : TONE.grey}
          loading={loading}
          note={activeDevice ? `${activeDevice.make} ${activeDevice.model}` : undefined}
        />
        <SummaryCard label="Tamper Events" value={events.length} icon={Activity} tone={events.length ? TONE.amber : TONE.grey} loading={loading} note="last 20" />
        <SummaryCard label="Events Today" value={eventsToday} icon={AlertCircle} tone={eventsToday ? TONE.red : TONE.grey} loading={loading} />
        <SummaryCard label="Recovery Odds" value={`${recovery.score}%`} icon={TrendingUp} tone={recovery.tone} loading={loading} note={recovery.label} />
      </div>

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,420px)', gap: '20px', alignItems: 'start' }}>

        {/* Settings */}
        <Card>
          <CardHeader
            title="Protection Settings"
            subtitle="What LOQIT watches for on this device"
            action={settings && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: settings.is_enabled ? TONE.green : C.muted }}>
                  {settings.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
                <Toggle
                  value={settings.is_enabled}
                  onChange={(v) => setSettings(s => s ? { ...s, is_enabled: v } : s)}
                />
              </div>
            )}
          />

          <div style={{ padding: '0 24px 22px' }}>
            {loading || !settings ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton width={34} height={34} radius={10} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="35%" height={13} />
                      <Skeleton width="60%" height={11} style={{ marginTop: '6px' }} />
                    </div>
                    <Skeleton width={42} height={24} radius={999} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div style={{ opacity: settings.is_enabled ? 1 : 0.55, transition: 'opacity .2s ease' }}>
                  <ToggleRow icon={CreditCard} tone={TONE.red} label="SIM change watch"
                    desc="Marks the device lost automatically when the SIM is swapped"
                    value={settings.sim_watch} onChange={v => setSettings(s => s ? { ...s, sim_watch: v } : s)} />
                  <ToggleRow icon={Vibrate} tone={TONE.amber} label="Motion detection"
                    desc="Flags unusual movement while the device should be idle"
                    value={settings.motion_watch} onChange={v => setSettings(s => s ? { ...s, motion_watch: v } : s)} />
                  <ToggleRow icon={Bluetooth} tone={TONE.blue} label="Silent BLE broadcast"
                    desc="Keeps the rotating beacon running in stealth mode"
                    value={settings.ble_broadcast} onChange={v => setSettings(s => s ? { ...s, ble_broadcast: v } : s)} />
                  <ToggleRow icon={Camera} tone={TONE.green} label="Intruder camera capture"
                    desc="Silently takes a front-camera photo after a failed unlock"
                    value={settings.camera_capture} onChange={v => setSettings(s => s ? { ...s, camera_capture: v } : s)} last />
                </div>

                <div style={{ marginTop: '18px' }}>
                  <Field label="Lock screen message" hint="Shown on the device when it is locked remotely.">
                    <textarea
                      className="crm-input"
                      value={settings.lock_message}
                      onChange={e => setSettings(s => s ? { ...s, lock_message: e.target.value } : s)}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <Field label="Alert phone number" hint="Optional — where tamper alerts are sent by SMS.">
                    <input
                      className="crm-input"
                      style={inputStyle}
                      value={settings.alert_phone}
                      onChange={e => setSettings(s => s ? { ...s, alert_phone: e.target.value } : s)}
                      placeholder="+91…"
                    />
                  </Field>
                </div>

                {saveMsg && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', borderRadius: '12px', marginTop: '16px',
                    fontSize: '12.5px', fontWeight: 500,
                    background: saveMsg.type === 'err' ? '#FEF2F2' : '#ECFDF5',
                    border: `1px solid ${saveMsg.type === 'err' ? '#FECACA' : '#A7F3D0'}`,
                    color: saveMsg.type === 'err' ? '#991B1B' : '#065F46',
                  }}>
                    {saveMsg.type === 'err' ? <AlertCircle size={14} /> : <Check size={14} />}
                    {saveMsg.text}
                  </div>
                )}

                <div style={{ marginTop: '20px' }}>
                  <Button icon={Save} onClick={saveSettings} disabled={saving}>
                    {saving ? 'Saving…' : 'Save settings'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Tamper log */}
        <Card>
          <CardHeader title="Tamper Event Log" subtitle="Live — newest first" />
          <div style={{ padding: '0 0 8px' }}>
            {loading ? (
              <div style={{ padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', gap: '12px' }}>
                    <Skeleton width={34} height={34} radius={10} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="45%" height={13} />
                      <Skeleton width="70%" height={11} style={{ marginTop: '6px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No tamper events"
                body="Nothing suspicious has been detected on this device."
              />
            ) : (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                {events.map((ev, i) => {
                  const m = eventMeta(ev.event_type)
                  return (
                    <div key={ev.id} style={{
                      display: 'flex', gap: '11px', padding: '13px 24px',
                      borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      <IconTile icon={m.icon} tone={m.tone} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{m.label}</div>
                        <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '2px' }}>
                          {new Date(ev.triggered_at).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                        {ev.latitude != null && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            marginTop: '6px', fontSize: '11px', color: C.label,
                            fontFamily: 'ui-monospace, monospace',
                          }}>
                            <MapPin size={11} color={C.muted} />
                            {ev.latitude.toFixed(4)}, {ev.longitude?.toFixed(4)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Complaint draft */}
      {showComplaint && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(17,18,22,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', fontFamily: FONT,
          }}
          onClick={() => setShowComplaint(false)}
        >
          <div
            style={{ ...cardStyle, width: '100%', maxWidth: '720px', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: '12px', padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`,
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: '0 0 2px' }}>
                  Police Complaint Draft
                </h2>
                <p style={{ fontSize: '13px', color: C.muted, margin: 0, fontWeight: 500 }}>
                  Pre-filled from your device record and tamper log
                </p>
              </div>
              <button
                onClick={() => setShowComplaint(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', lineHeight: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px',
                padding: '11px 14px', marginBottom: '14px',
                fontSize: '12px', color: '#92400E', lineHeight: 1.55,
              }}>
                Replace the bracketed placeholders before submitting. This is a draft, not a filed FIR.
              </div>
              <pre style={{
                margin: 0, padding: '16px', borderRadius: '12px',
                background: C.tile, border: `1px solid ${C.tileBorder}`,
                fontSize: '12px', lineHeight: 1.65, color: C.heading,
                fontFamily: 'ui-monospace, monospace',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {complaintText}
              </pre>
            </div>

            <div style={{
              display: 'flex', gap: '8px', justifyContent: 'flex-end',
              padding: '14px 24px', borderTop: `1px solid ${C.border}`,
            }}>
              <Button variant="ghost" onClick={() => setShowComplaint(false)}>Close</Button>
              <Button icon={copied ? Check : Copy} onClick={copyComplaint}>
                {copied ? 'Copied' : 'Copy draft'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
