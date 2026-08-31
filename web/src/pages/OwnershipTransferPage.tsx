import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Smartphone, UserSearch, CheckCircle2, Check, AlertCircle,
  Search, ArrowLeftRight, Loader2, ShieldAlert,
} from 'lucide-react'
import { db } from '../lib/db'
import { useDevices, Device } from '../hooks/useDevices'
import {
  C, TONE, FONT, Page, PageHeader, Card, CardHeader, Button, Badge,
  EmptyState, Field, inputStyle, IconTile,
} from '../components/crm'

const STEPS = [
  { n: 1, label: 'Select device', icon: Smartphone },
  { n: 2, label: 'Confirm recipient', icon: UserSearch },
  { n: 3, label: 'Done', icon: CheckCircle2 },
] as const

export function OwnershipTransferPage() {
  const navigate = useNavigate()
  const { devices } = useDevices()
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [reason, setReason] = useState<'selling' | 'gifting' | 'other'>('selling')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [recipientProfile, setRecipientProfile] = useState<{ id: string; full_name: string } | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [transferError, setTransferError] = useState('')

  const lookupRecipient = async () => {
    if (!recipientEmail.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setRecipientProfile(null)
    try {
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', recipientEmail.trim().toLowerCase())
        .single()

      if (error || !data) {
        setLookupError('No LOQIT account found for that email. The recipient has to register first.')
        return
      }
      setRecipientProfile(data as { id: string; full_name: string })
      setStep(2)
    } catch {
      setLookupError('Could not look up that recipient. Check the email address.')
    } finally {
      setLookupLoading(false)
    }
  }

  const initiateTransfer = async () => {
    if (!selectedDevice || !recipientProfile) return
    setLoading(true)
    setTransferError('')
    try {
      const { error } = await db
        .from('devices')
        .update({ owner_id: recipientProfile.id, status: 'registered' })
        .eq('id', selectedDevice.id)

      if (error) throw error
      setStep(3)
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Transfer failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Transfer Ownership"
        subtitle="Hand a registered device over to another LOQIT user"
        actions={<Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/devices')}>Back to devices</Button>}
      />

      {/* Steps */}
      <Card style={{ padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {STEPS.map((s, i) => {
            const done = step > s.n
            const active = step === s.n
            const Icon = done ? CheckCircle2 : s.icon
            return (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  padding: '8px 12px', borderRadius: '999px', minWidth: 0,
                  background: active ? 'rgba(39,118,234,.06)' : 'transparent',
                  border: `1px solid ${active ? C.primary : 'transparent'}`,
                }}>
                  <Icon size={16} color={done ? TONE.green : active ? C.primary : C.muted} strokeWidth={1.9} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: '12.5px', fontWeight: active ? 600 : 500,
                    color: done ? TONE.green : active ? C.primary : C.muted,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '1px', background: C.tileBorder, minWidth: '12px' }} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: '20px', alignItems: 'start' }}>

        <Card>
          {step === 1 && (
            <>
              <CardHeader title="Select a device" subtitle="Choose which device to transfer, then name the recipient" />
              <div style={{ padding: '0 24px 24px' }}>
                {devices.length === 0 ? (
                  <EmptyState
                    icon={Smartphone}
                    title="No devices to transfer"
                    body="You need a registered device before you can hand one over."
                    action={<Button onClick={() => navigate('/add-device')}>Register a device</Button>}
                  />
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      {devices.map(d => {
                        const active = selectedDevice?.id === d.id
                        const isLost = d.status === 'lost' || d.status === 'stolen'
                        return (
                          <button
                            key={d.id}
                            onClick={() => setSelectedDevice(d)}
                            disabled={isLost}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '11px',
                              padding: '12px 14px', borderRadius: '12px', width: '100%',
                              textAlign: 'left', fontFamily: FONT,
                              cursor: isLost ? 'not-allowed' : 'pointer',
                              opacity: isLost ? 0.55 : 1,
                              background: active ? 'rgba(39,118,234,.05)' : C.card,
                              border: `1px solid ${active ? C.primary : C.border}`,
                              transition: 'all .15s ease',
                            }}
                          >
                            <IconTile icon={Smartphone} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{d.make} {d.model}</div>
                              <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '1px', fontFamily: 'ui-monospace, monospace' }}>
                                {d.serial_number}
                              </div>
                            </div>
                            {isLost
                              ? <Badge tone={TONE.red}>Cannot transfer</Badge>
                              : active && <Check size={16} color={C.primary} />}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '18px' }}>
                      <Field label="Recipient's LOQIT email" hint="They must already have a LOQIT account.">
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            className="crm-input"
                            style={inputStyle}
                            type="email"
                            value={recipientEmail}
                            onChange={(e) => { setRecipientEmail(e.target.value); setLookupError('') }}
                            placeholder="name@example.com"
                            disabled={!selectedDevice}
                          />
                          <Button
                            icon={lookupLoading ? Loader2 : Search}
                            onClick={lookupRecipient}
                            disabled={!selectedDevice || !recipientEmail.trim() || lookupLoading}
                          >
                            {lookupLoading ? 'Looking up…' : 'Find'}
                          </Button>
                        </div>
                      </Field>

                      {!selectedDevice && (
                        <p style={{ fontSize: '12px', color: C.muted, margin: '10px 0 0' }}>
                          Pick a device above first.
                        </p>
                      )}

                      {lookupError && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '10px 14px', borderRadius: '12px', marginTop: '12px',
                          background: '#FEF2F2', border: '1px solid #FECACA',
                          color: '#991B1B', fontSize: '12.5px',
                        }}>
                          <AlertCircle size={14} style={{ flexShrink: 0 }} />
                          {lookupError}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {step === 2 && selectedDevice && recipientProfile && (
            <>
              <CardHeader title="Confirm the transfer" subtitle="Check both sides before you hand it over" />
              <div style={{ padding: '0 24px 24px' }}>
                <div style={{ background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '18px' }}>
                  {[
                    { label: 'Device', value: `${selectedDevice.make} ${selectedDevice.model}` },
                    { label: 'Serial number', value: selectedDevice.serial_number, mono: true },
                    { label: 'New owner', value: recipientProfile.full_name || '—' },
                    { label: 'Recipient email', value: recipientEmail },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between', gap: '12px',
                      padding: '11px 14px',
                      borderBottom: i < arr.length - 1 ? `1px solid ${C.tileBorder}` : 'none',
                    }}>
                      <span style={{ fontSize: '12px', color: C.label }}>{row.label}</span>
                      <span style={{
                        fontSize: '12.5px', fontWeight: 500, color: C.heading, textAlign: 'right',
                        fontFamily: row.mono ? 'ui-monospace, monospace' : 'inherit', wordBreak: 'break-all',
                      }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <Field label="Reason for transfer">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {([['selling', 'Selling'], ['gifting', 'Gifting'], ['other', 'Other']] as const).map(([key, label]) => {
                      const active = reason === key
                      return (
                        <button
                          key={key}
                          onClick={() => setReason(key)}
                          style={{
                            padding: '8px 16px', borderRadius: '999px', cursor: 'pointer',
                            fontSize: '12.5px', fontWeight: active ? 600 : 500, fontFamily: FONT,
                            background: active ? 'rgba(39,118,234,.06)' : C.card,
                            border: `1px solid ${active ? C.primary : C.border}`,
                            color: active ? C.primary : C.label,
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <div style={{
                  display: 'flex', gap: '10px', marginTop: '18px',
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: '12px', padding: '13px 15px',
                }}>
                  <ShieldAlert size={16} color={TONE.amber} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <p style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: 1.6 }}>
                    This is immediate and cannot be undone from your account. Once transferred, the
                    device leaves your dashboard and its protection settings and history belong to
                    the new owner.
                  </p>
                </div>

                {transferError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', borderRadius: '12px', marginTop: '12px',
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    color: '#991B1B', fontSize: '12.5px',
                  }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    {transferError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <Button icon={ArrowLeftRight} onClick={initiateTransfer} disabled={loading}>
                    {loading ? 'Transferring…' : 'Confirm transfer'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setStep(1); setRecipientProfile(null) }}>Back</Button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <EmptyState
              icon={CheckCircle2}
              title="Transfer complete"
              body={`${selectedDevice?.make} ${selectedDevice?.model} now belongs to ${recipientProfile?.full_name || recipientEmail}. It has been removed from your dashboard.`}
              action={<Button onClick={() => navigate('/devices')}>Back to devices</Button>}
            />
          )}
        </Card>

        {/* Side notes */}
        <Card>
          <CardHeader title="Before you transfer" subtitle="Worth checking first" />
          <div style={{ padding: '0 24px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: UserSearch, tone: TONE.blue, title: 'The recipient needs an account', body: 'They have to register with LOQIT before the device can be handed over.' },
              { icon: ShieldAlert, tone: TONE.amber, title: 'Lost devices cannot move', body: 'A device marked lost or stolen must be recovered before transferring.' },
              { icon: ArrowLeftRight, tone: TONE.green, title: 'Ownership moves immediately', body: 'The LOQIT key stays with the hardware, but control passes to the new owner.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: '11px' }}>
                <IconTile icon={item.icon} tone={item.tone} size={32} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{item.title}</div>
                  <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0', lineHeight: 1.55 }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}
