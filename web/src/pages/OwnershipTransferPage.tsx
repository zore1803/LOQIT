import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Colors } from '../lib/colors'
import { supabase } from '../lib/supabase'
import { useDevices, Device } from '../hooks/useDevices'
import { Card } from '../components/Card'
import { Button } from '../components/Button'

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

  const lookupRecipient = async () => {
    if (!recipientEmail.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setRecipientProfile(null)
    try {
      // Look up user by email via auth - we'll check profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', recipientEmail.trim().toLowerCase())
        .single()

      if (error || !data) {
        setLookupError('No LOQIT account found for this email. The recipient must register first.')
        return
      }
      setRecipientProfile(data as { id: string; full_name: string })
      setStep(2)
    } catch {
      setLookupError('Could not find recipient. Please check the email address.')
    } finally {
      setLookupLoading(false)
    }
  }

  const initiateTransfer = async () => {
    if (!selectedDevice || !recipientProfile) return
    setLoading(true)
    try {
      // In a real system this would create a transfer_requests table entry
      // For now we update the device owner directly after confirmation
      // Create a system message / note about the transfer
      const { error } = await supabase
        .from('devices')
        .update({ owner_id: recipientProfile.id, status: 'registered' })
        .eq('id', selectedDevice.id)

      if (error) throw error
      setStep(3)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transfer failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: '12px', fontSize: '15px',
    background: Colors.surfaceContainerHigh, border: `1px solid ${Colors.outlineVariant}`,
    color: Colors.onSurface, outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  }

  return (
    <div style={{ padding: '32px', maxWidth: '680px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/devices')} style={{ background: 'none', border: 'none', color: Colors.onSurfaceVariant, cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Ownership Transfer</h1>
          <p style={{ color: Colors.onSurfaceVariant, fontSize: '15px', margin: '4px 0 0' }}>Securely transfer device ownership to another LOQIT user</p>
        </div>
      </div>

      {/* Progress steps */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '32px', background: Colors.surfaceContainerLow, borderRadius: '14px', padding: '4px' }}>
        {[['Select Device', 'devices'], ['Confirm Recipient', 'person_search'], ['Done', 'check_circle']].map(([label, icon], i) => {
          const stepNum = (i + 1) as 1 | 2 | 3
          const isActive = step === stepNum
          const isDone = step > stepNum
          return (
            <div key={label} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: isActive ? `${Colors.primary}22` : 'none', textAlign: 'center' }}>
              <span className="material-icons" style={{ fontSize: '20px', color: isDone ? Colors.secondary : isActive ? Colors.primary : Colors.outline, display: 'block' }}>
                {isDone ? 'check_circle' : icon}
              </span>
              <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? Colors.primary : Colors.onSurfaceVariant, marginTop: '4px' }}>{label}</div>
            </div>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select device + recipient */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ color: Colors.onSurface, fontWeight: 700, marginBottom: '16px' }}>Select Device to Transfer</h3>
              {devices.length === 0 ? (
                <p style={{ color: Colors.onSurfaceVariant, textAlign: 'center', padding: '20px' }}>No devices registered</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {devices.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDevice(d)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                        borderRadius: '12px', border: `2px solid ${selectedDevice?.id === d.id ? Colors.primary : Colors.outlineVariant}`,
                        background: selectedDevice?.id === d.id ? `${Colors.primary}12` : Colors.surfaceContainerHigh,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '28px', color: selectedDevice?.id === d.id ? Colors.primary : Colors.outline }}>smartphone</span>
                      <div>
                        <div style={{ fontWeight: 700, color: Colors.onSurface }}>{d.make} {d.model}</div>
                        <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>Serial: {d.serial_number}</div>
                      </div>
                      {selectedDevice?.id === d.id && (
                        <span className="material-icons" style={{ marginLeft: 'auto', color: Colors.primary }}>check_circle</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {selectedDevice && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card style={{ padding: '24px', marginBottom: '20px' }}>
                  <h3 style={{ color: Colors.onSurface, fontWeight: 700, marginBottom: '16px' }}>Transfer Reason</h3>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {[['selling', 'Selling', 'sell'], ['gifting', 'Gifting', 'card_giftcard'], ['other', 'Other', 'more_horiz']].map(([val, label, icon]) => (
                      <button key={val} onClick={() => setReason(val as typeof reason)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px',
                        border: `1px solid ${reason === val ? Colors.primary : Colors.outlineVariant}`,
                        background: reason === val ? `${Colors.primary}18` : Colors.surfaceContainerHigh,
                        color: reason === val ? Colors.primary : Colors.onSurfaceVariant,
                        cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px' }}>{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>

                  <h3 style={{ color: Colors.onSurface, fontWeight: 700, marginBottom: '12px' }}>Recipient Email</h3>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <input
                      type="email" placeholder="recipient@example.com"
                      value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <Button onClick={lookupRecipient} loading={lookupLoading} disabled={!recipientEmail.trim()}>
                      Look Up
                    </Button>
                  </div>
                  {lookupError && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: `${Colors.error}18`, color: Colors.error, fontSize: '13px', border: `1px solid ${Colors.error}33` }}>
                      {lookupError}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && recipientProfile && selectedDevice && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card style={{ padding: '28px', marginBottom: '20px' }}>
              <h3 style={{ color: Colors.onSurface, fontWeight: 700, marginBottom: '20px' }}>Confirm Transfer</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ background: Colors.surfaceContainerHigh, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <span className="material-icons" style={{ fontSize: '32px', color: Colors.primary, display: 'block', marginBottom: '8px' }}>person</span>
                  <div style={{ fontWeight: 700, color: Colors.onSurface, fontSize: '14px' }}>You (Current Owner)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span className="material-icons" style={{ color: Colors.tertiary, fontSize: '28px' }}>arrow_forward</span>
                </div>
                <div style={{ background: `${Colors.secondary}18`, borderRadius: '12px', padding: '16px', textAlign: 'center', border: `1px solid ${Colors.secondary}33` }}>
                  <span className="material-icons" style={{ fontSize: '32px', color: Colors.secondary, display: 'block', marginBottom: '8px' }}>person_add</span>
                  <div style={{ fontWeight: 700, color: Colors.onSurface, fontSize: '14px' }}>{recipientProfile.full_name}</div>
                  <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>{recipientEmail}</div>
                </div>
              </div>

              <div style={{ background: Colors.surfaceContainerHigh, borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontWeight: 600, color: Colors.onSurface, marginBottom: '4px' }}>{selectedDevice.make} {selectedDevice.model}</div>
                <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>Serial: {selectedDevice.serial_number}</div>
                <div style={{ fontSize: '13px', color: Colors.tertiary, marginTop: '4px', textTransform: 'capitalize' }}>Reason: {reason}</div>
              </div>

              <div style={{ background: `${Colors.error}12`, border: `1px solid ${Colors.error}33`, borderRadius: '12px', padding: '14px 16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span className="material-icons" style={{ color: Colors.error, fontSize: '18px', flexShrink: 0 }}>warning</span>
                  <p style={{ color: Colors.onSurface, fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                    This action is <strong>irreversible</strong>. Once transferred, the new owner will have full control of this device on LOQIT. Make sure you trust the recipient.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="outline" fullWidth onClick={() => { setStep(1); setRecipientProfile(null) }}>Back</Button>
                <Button fullWidth onClick={initiateTransfer} loading={loading} icon="swap_horiz">
                  Confirm Transfer
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card style={{ padding: '48px', textAlign: 'center' }}>
              <motion.div animate={{ scale: [0.5, 1.2, 1] }} transition={{ duration: 0.6 }}>
                <span className="material-icons" style={{ fontSize: '72px', color: Colors.secondary, display: 'block', marginBottom: '20px' }}>check_circle</span>
              </motion.div>
              <h2 style={{ color: Colors.onSurface, fontWeight: 800, fontSize: '24px', marginBottom: '12px' }}>Transfer Complete!</h2>
              <p style={{ color: Colors.onSurfaceVariant, fontSize: '15px', lineHeight: 1.7, marginBottom: '32px' }}>
                <strong>{selectedDevice?.make} {selectedDevice?.model}</strong> has been transferred to <strong>{recipientProfile?.full_name}</strong>. The device is now under their account.
              </p>
              <Button onClick={() => navigate('/devices')} fullWidth icon="devices">Back to My Devices</Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
