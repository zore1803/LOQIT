import { CSSProperties, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Colors } from '../lib/colors'
import { useDevices } from '../hooks/useDevices'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

const BRANDS = [
  'Apple',
  'Samsung',
  'Google',
  'OnePlus',
  'Xiaomi',
  'Oppo',
  'Vivo',
  'Realme',
  'Motorola',
  'Nokia',
  'Sony',
  'LG',
  'Huawei',
  'Other',
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

  // IMEI validation removed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    // Duplicate check removed

    // 3. Register the device
    try {
      const { error } = await addDevice({
        state,
        make,
        model,
        imei_primary: `BLE-${serialNumber}`,
        imei_secondary: null,
        serial_number: serialNumber,
        color: color || null,
        purchase_date: purchaseDate || null,
      })

      if (error) throw error
      navigate('/devices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add device. Ensure all fields are valid.')
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: CSSProperties = {
    padding: '40px',
    maxWidth: '900px',
    margin: '0 auto',
  }

  const headerStyle: CSSProperties = {
    marginBottom: '40px',
    background: `linear-gradient(135deg, ${Colors.primary}10 0%, transparent 100%)`,
    padding: '32px',
    borderRadius: '20px',
    border: `1px solid ${Colors.primary}20`,
  }

  const titleStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    color: Colors.onSurface,
    marginBottom: '12px',
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const subtitleStyle: CSSProperties = {
    color: Colors.onSurfaceVariant,
    fontSize: '16px',
    lineHeight: '1.5',
  }

  const formStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  }

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: Colors.surfaceContainerHigh,
    border: `1px solid ${Colors.outlineVariant}`,
    borderRadius: '12px',
    color: Colors.onSurface,
    fontSize: '16px',
    cursor: 'pointer',
  }

  const labelStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: Colors.onSurface,
    marginBottom: '10px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }

  const colorGridStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '8px',
  }

  const colorSwatchStyle = (colorValue: string, isSelected: boolean): CSSProperties => ({
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: colorValue,
    cursor: 'pointer',
    border: isSelected ? `4px solid ${Colors.primary}` : `3px solid ${Colors.outline}`,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isSelected ? `0 4px 12px ${Colors.primary}40` : 'none',
  })

  const errorStyle: CSSProperties = {
    backgroundColor: `${Colors.error}20`,
    color: Colors.error,
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '15px',
    border: `2px solid ${Colors.error}40`,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontWeight: 600,
    marginBottom: '24px',
  }

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '16px',
  }



  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>
          <span className="material-icons" style={{ fontSize: '36px', color: Colors.primary }}>
            add_circle
          </span>
          Register New Device
        </h1>
        <p style={subtitleStyle}>
          Add your device to LOQIT to protect it and enable recovery features
        </p>
      </div>

      <Card variant="elevated" padding="32px">
        {error && (
          <div style={errorStyle}>
            <span className="material-icons">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>State *</label>
              <select
                style={selectStyle}
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              >
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Brand *</label>
              <select
                style={selectStyle}
                value={make}
                onChange={(e) => setMake(e.target.value)}
                required
              >
                <option value="">Select brand</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={rowStyle}>
            <Input
              label="Model *"
              placeholder="e.g., iPhone 15 Pro"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            />

            <Input
              label="Serial Number *"
              placeholder="Device serial number"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              required
            />
          </div>

          {/* IMEI fields removed */}

          <div style={rowStyle}>
            <Input
              label="Purchase Date (Optional)"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Device Color (Optional)</label>
            <div style={colorGridStyle}>
              {COLORS.map((c) => (
                <div
                  key={c.name}
                  style={colorSwatchStyle(c.value, color === c.value)}
                  onClick={() => setColor(color === c.value ? '' : c.value)}
                  title={c.name}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                />
              ))}
            </div>
          </div>

          {/* IMEI info card removed */}

          <div style={actionsStyle}>
            <Button variant="ghost" onClick={() => navigate('/devices')} style={{ border: `2px solid ${Colors.outlineVariant}` }} icon="close">
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!make || !model || !serialNumber} icon="check_circle" size="large">
              Register Device
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
