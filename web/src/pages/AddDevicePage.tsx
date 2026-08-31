import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Smartphone, ArrowLeft, Check, AlertCircle, ShieldCheck, KeyRound, Radio,
} from 'lucide-react'
import { useDevices } from '../hooks/useDevices'
import {
  C, TONE, FONT, Page, PageHeader, Card, CardHeader, Button,
  Field, inputStyle, IconTile,
} from '../components/crm'

const BRANDS = [
  'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Oppo', 'Vivo',
  'Realme', 'Motorola', 'Nokia', 'Sony', 'LG', 'Huawei', 'Other',
]

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
]

const COLORS = [
  { name: 'Black', value: '#1a1a1a' },
  { name: 'White', value: '#f5f5f5' },
  { name: 'Silver', value: '#c0c0c0' },
  { name: 'Gold', value: '#ffd700' },
  { name: 'Rose Gold', value: '#e8b4b8' },
  { name: 'Blue', value: '#4a90d9' },
  { name: 'Green', value: '#4caf50' },
  { name: 'Red', value: '#ef5350' },
  { name: 'Purple', value: '#9c27b0' },
]

export function AddDevicePage() {
  const navigate = useNavigate()
  const { addDevice } = useDevices()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')

  const [state, setState] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [color, setColor] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const { error: addError } = await addDevice({
        state,
        make,
        model,
        imei_primary: `BLE-${serialNumber}`,
        imei_secondary: null,
        serial_number: serialNumber,
        color: color || null,
        purchase_date: purchaseDate || null,
      })

      if (addError) throw addError
      navigate('/devices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register the device. Check the fields and try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'auto' as const }

  return (
    <Page>
      <PageHeader
        title="Register a Device"
        subtitle="Link a phone to your account so LOQIT can protect and recover it"
        actions={<Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/devices')}>Back to devices</Button>}
      />

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: '20px', alignItems: 'start' }}>

        <Card>
          <CardHeader title="Device Details" subtitle="The serial number is what ties this device to you" />

          <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px' }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '11px 14px', borderRadius: '12px', marginBottom: '18px',
                background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#991B1B', fontSize: '13px', fontWeight: 500, fontFamily: FONT,
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <div className="crm-c2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="Brand">
                <select className="crm-input" style={selectStyle} value={make} onChange={(e) => setMake(e.target.value)} required>
                  <option value="">Select a brand</option>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>

              <Field label="Model">
                <input className="crm-input" style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Nord CE 3" required />
              </Field>
            </div>

            <div style={{ marginTop: '16px' }}>
              <Field
                label="Serial number"
                hint="Dial *#06# on the phone, or find it in Settings → About phone. This is how a recovered device is matched back to you."
              >
                <input
                  className="crm-input"
                  style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.5px' }}
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.trim())}
                  placeholder="e.g. CPH2401"
                  required
                />
              </Field>
            </div>

            <div className="crm-c2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <Field label="State or region">
                <select className="crm-input" style={selectStyle} value={state} onChange={(e) => setState(e.target.value)} required>
                  <option value="">Select a state</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Purchase date" hint="Optional — helps prove ownership.">
                <input className="crm-input" style={inputStyle} type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </Field>
            </div>

            <div style={{ marginTop: '18px' }}>
              <Field label="Colour" hint="Optional — makes the device easier to identify in a list.">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {COLORS.map(c => {
                    const active = color === c.name
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setColor(active ? '' : c.name)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '7px',
                          padding: '7px 12px', borderRadius: '999px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 500, fontFamily: FONT,
                          background: active ? 'rgba(39,118,234,.06)' : C.card,
                          border: `1px solid ${active ? C.primary : C.border}`,
                          color: active ? C.primary : C.label,
                          transition: 'all .15s ease',
                        }}
                      >
                        <span style={{
                          width: '12px', height: '12px', borderRadius: '50%',
                          background: c.value, border: `1px solid ${C.tileBorder}`, flexShrink: 0,
                        }} />
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <Button type="submit" icon={Check} disabled={loading}>
                {loading ? 'Registering…' : 'Register Device'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/devices')}>Cancel</Button>
            </div>
          </form>
        </Card>

        {/* What happens next */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <CardHeader title="What happens next" subtitle="After you register" />
            <div style={{ padding: '0 24px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { icon: KeyRound, tone: TONE.blue, title: 'A LOQIT key is issued', body: 'A unique key is generated and bound to this serial number as proof of ownership.' },
                { icon: Radio, tone: TONE.green, title: 'The device joins the mesh', body: 'Once the app is installed, it can broadcast a rotating beacon if it is ever lost.' },
                { icon: ShieldCheck, tone: TONE.amber, title: 'Protection can be enabled', body: 'Turn on anti-theft to block factory resets and power-offs from the Anti-Theft page.' },
              ].map(step => (
                <div key={step.title} style={{ display: 'flex', gap: '11px' }}>
                  <IconTile icon={step.icon} tone={step.tone} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{step.title}</div>
                    <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0', lineHeight: 1.55 }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: '16px', background: C.tile }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Smartphone size={16} color={C.primary} style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '12px', color: C.label, margin: 0, lineHeight: 1.6 }}>
                Register the device you actually carry. Recovery only works for devices that
                are registered <em>before</em> they go missing.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  )
}
