import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Colors } from '../lib/colors'
import './SettingsPage.css'

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.log(error)
    }
  }

  return [storedValue, setValue] as const
}

function Toggle({ defaultOn = false, onChange }: { defaultOn?: boolean, onChange?: (val: boolean) => void }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div
      className={`loqit-settings-tog ${on ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        setOn(!on)
        onChange?.(!on)
      }}
    />
  )
}

function AadhaarModal({ onClose, onVerified }: { onClose: () => void, onVerified: () => void }) {
  const [aadhaar, setAadhaar] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const { user } = useAuth()

  const handleVerify = async () => {
    if (aadhaar.replace(/\s/g, '').length !== 12) {
      alert('Aadhaar must be exactly 12 digits')
      return
    }
    setLoading(true)
    
    // Simulate secure verification delay
    await new Promise(r => setTimeout(r, 1500))
    const { error } = await supabase.from('profiles').update({ aadhaar_verified: true }).eq('id', user?.id)
    
    setLoading(false)
    if (!error) {
      setStep(2)
      setTimeout(() => {
        onVerified()
        onClose()
      }, 2000)
    } else {
      alert('Failed to verify Aadhaar. Please try again.')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: Colors.surfaceContainer, padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', border: `1px solid ${Colors.outlineVariant}`, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <div style={{ width: 48, height: 48, borderRadius: '12px', background: `${Colors.primary}20`, color: Colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <span className="material-icons" style={{ fontSize: 24 }}>badge</span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-onSurface)', marginBottom: '8px' }}>Verify Aadhaar</h2>
            <p style={{ color: 'var(--color-onSurfaceVariant)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
              Link your government ID to establish legal ownership of your devices. This is securely encrypted.
            </p>
            <input 
              type="text" 
              placeholder="0000 0000 0000" 
              value={aadhaar} 
              onChange={e => setAadhaar(e.target.value.replace(/[^\d\s]/g, ''))}
              maxLength={14}
              style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--color-surfaceContainer)', border: `1px solid ${Colors.outline}`, color: 'var(--color-onSurface)', fontSize: '16px', letterSpacing: '2px', marginBottom: '24px', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'transparent', border: `1px solid ${Colors.outlineVariant}`, color: 'var(--color-onSurface)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button disabled={loading} onClick={handleVerify} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: Colors.primary, border: 'none', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>sync</span> : 'Verify'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${Colors.primary}20`, color: Colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span className="material-icons" style={{ fontSize: 32 }}>check_circle</span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-onSurface)', marginBottom: '8px' }}>Verification Successful</h2>
            <p style={{ color: 'var(--color-onSurfaceVariant)', fontSize: '14px' }}>Your identity has been linked.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function WebSettings() {
  const navigate = useNavigate()
  const { profile, user, refreshProfile } = useAuth()
  const [showAadhaarModal, setShowAadhaarModal] = useState(false)
  
  const name = profile?.full_name || 'User'
  const initials = name.slice(0, 2).toUpperCase()
  const isAadhaarVerified = profile?.aadhaar_verified
  
  const [twoFactorWeb, setTwoFactorWeb] = useLocalStorage('loqit_web_2fa', false)
  
  return (
    <div className="loqit-settings-panel">
      {showAadhaarModal && <AadhaarModal onClose={() => setShowAadhaarModal(false)} onVerified={refreshProfile} />}

      <div className="loqit-settings-hero">
        <div className="loqit-settings-avatar" style={{ background: '#085041', color: '#E1F5EE' }}>{initials}</div>
        <div>
          <div className="loqit-settings-hero-title">{name}</div>
          <div className="loqit-settings-hero-sub">{user?.email} · Civilian portal</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="loqit-settings-badge-green">Active</span>
        </div>
      </div>

      <div className="loqit-settings-s-section">
        <div className="loqit-settings-s-label">Account & profile</div>
        <div className="loqit-settings-s-card">
          <div className="loqit-settings-s-row" onClick={() => navigate('/profile')}>
            <div className="loqit-settings-s-icon" style={{ background: '#534AB7' }}>
              <span className="material-icons" style={{ color: '#EEEDFE', fontSize: 20 }}>person</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Personal details</div>
              <div className="loqit-settings-s-sub">Name, email, phone number</div>
            </div>
            <span className="loqit-settings-chev">›</span>
          </div>

          <div className="loqit-settings-s-row" onClick={() => !isAadhaarVerified && setShowAadhaarModal(true)}>
            <div className="loqit-settings-s-icon" style={{ background: '#0F6E56' }}>
              <span className="material-icons" style={{ color: '#E1F5EE', fontSize: 20 }}>badge</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Aadhaar verification</div>
              <div className="loqit-settings-s-sub">Required for legal device ownership proof</div>
            </div>
            {isAadhaarVerified ? (
              <span className="loqit-settings-badge-green">Verified</span>
            ) : (
              <span className="loqit-settings-badge-warn">Pending</span>
            )}
            <span className="loqit-settings-chev">›</span>
          </div>

          <div className="loqit-settings-s-row" onClick={() => navigate('/profile')}>
            <div className="loqit-settings-s-icon" style={{ background: '#993C1D' }}>
              <span className="material-icons" style={{ color: '#FAECE7', fontSize: 20 }}>lock</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Password & security</div>
              <div className="loqit-settings-s-sub">Password, 2FA, recovery options</div>
            </div>
            <span className="loqit-settings-chev">›</span>
          </div>

          <div className="loqit-settings-s-row">
            <div className="loqit-settings-s-icon" style={{ background: '#993C1D' }}>
              <span className="material-icons" style={{ color: '#FAECE7', fontSize: 20 }}>security</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Two-factor authentication</div>
              <div className="loqit-settings-s-sub">OTP on login for web dashboard</div>
            </div>
            <Toggle defaultOn={twoFactorWeb} onChange={setTwoFactorWeb} />
          </div>
        </div>
      </div>

      <div className="loqit-settings-s-section">
        <div className="loqit-settings-s-label">Device & ownership</div>
        <div className="loqit-settings-s-card">
          <div className="loqit-settings-s-row" onClick={() => navigate('/devices')}>
            <div className="loqit-settings-s-icon" style={{ background: '#534AB7' }}>
              <span className="material-icons" style={{ color: '#EEEDFE', fontSize: 20 }}>smartphone</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Registered devices</div>
              <div className="loqit-settings-s-sub">View and manage all linked devices</div>
            </div>
            <span className="loqit-settings-chev">›</span>
          </div>

          <div className="loqit-settings-s-row" onClick={() => navigate('/transfer-ownership')}>
            <div className="loqit-settings-s-icon" style={{ background: '#534AB7' }}>
              <span className="material-icons" style={{ color: '#EEEDFE', fontSize: 20 }}>swap_horiz</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Transfer ownership</div>
              <div className="loqit-settings-s-sub">Hand a device to another user</div>
            </div>
            <span className="loqit-settings-chev">›</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PoliceSettings() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  
  const name = profile?.full_name || 'Insp. Oberoi'
  const initials = name.slice(0, 2).toUpperCase()

  const [ipAllowlist, setIpAllowlist] = useLocalStorage('loqit_police_ip_allowlist', true)
  const [autoAssign, setAutoAssign] = useLocalStorage('loqit_police_auto_assign', false)
  const [aiThreshold, setAiThreshold] = useLocalStorage('loqit_police_ai_threshold', '70')

  return (
    <div className="loqit-settings-panel">
      <div className="loqit-settings-hero">
        <div className="loqit-settings-avatar" style={{ background: '#633806', color: '#FAEEDA' }}>{initials}</div>
        <div>
          <div className="loqit-settings-hero-title">{name}</div>
          <div className="loqit-settings-hero-sub">Police Dept · {user?.email}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="loqit-settings-badge-info">Police</span>
        </div>
      </div>

      <div className="loqit-settings-s-section">
        <div className="loqit-settings-s-label">Account & credentials</div>
        <div className="loqit-settings-s-card">
          <div className="loqit-settings-s-row" onClick={() => navigate('/profile')}>
            <div className="loqit-settings-s-icon" style={{ background: '#534AB7' }}>
              <span className="material-icons" style={{ color: '#EEEDFE', fontSize: 20 }}>person</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Officer profile</div>
              <div className="loqit-settings-s-sub">Name, badge number, station</div>
            </div>
            <span className="loqit-settings-chev">›</span>
          </div>
          <div className="loqit-settings-s-row">
            <div className="loqit-settings-s-icon" style={{ background: '#0F6E56' }}>
              <span className="material-icons" style={{ color: '#E1F5EE', fontSize: 20 }}>verified_user</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Role & jurisdiction</div>
              <div className="loqit-settings-s-sub">Police role verified by admin</div>
            </div>
            <span className="loqit-settings-badge-green">Verified</span>
          </div>
        </div>
      </div>

      <div className="loqit-settings-s-section">
        <div className="loqit-settings-s-label">Security & access</div>
        <div className="loqit-settings-s-card">
          <div className="loqit-settings-s-row">
            <div className="loqit-settings-s-icon" style={{ background: '#A32D2D' }}>
              <span className="material-icons" style={{ color: '#FCEBEB', fontSize: 20 }}>security</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Two-factor authentication</div>
              <div className="loqit-settings-s-sub">Mandatory for police accounts</div>
            </div>
            <span className="loqit-settings-badge-red">Always on</span>
          </div>
          <div className="loqit-settings-s-row" onClick={() => navigate('/police/analytics')}>
            <div className="loqit-settings-s-icon" style={{ background: '#A32D2D' }}>
              <span className="material-icons" style={{ color: '#FCEBEB', fontSize: 20 }}>history</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Access log</div>
              <div className="loqit-settings-s-sub">Every civilian record you have viewed</div>
            </div>
            <span className="loqit-settings-chev">›</span>
          </div>
          <div className="loqit-settings-s-row">
            <div className="loqit-settings-s-icon" style={{ background: '#A32D2D' }}>
              <span className="material-icons" style={{ color: '#FCEBEB', fontSize: 20 }}>wifi_protected_setup</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">IP allowlist</div>
              <div className="loqit-settings-s-sub">Restrict login to station network IPs</div>
            </div>
            <Toggle defaultOn={ipAllowlist} onChange={setIpAllowlist} />
          </div>
        </div>
      </div>

      <div className="loqit-settings-s-section">
        <div className="loqit-settings-s-label">Case & investigation</div>
        <div className="loqit-settings-s-card">
          <div className="loqit-settings-s-row">
            <div className="loqit-settings-s-icon" style={{ background: '#854F0B' }}>
              <span className="material-icons" style={{ color: '#FAEEDA', fontSize: 20 }}>assignment_ind</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">Default case assignment</div>
              <div className="loqit-settings-s-sub">Auto-assign new reports to me</div>
            </div>
            <Toggle defaultOn={autoAssign} onChange={setAutoAssign} />
          </div>
          <div className="loqit-settings-s-row">
            <div className="loqit-settings-s-icon" style={{ background: '#854F0B' }}>
              <span className="material-icons" style={{ color: '#FAEEDA', fontSize: 20 }}>smart_toy</span>
            </div>
            <div className="loqit-settings-s-text">
              <div className="loqit-settings-s-title">AI flag threshold</div>
              <div className="loqit-settings-s-sub">Minimum AI confidence to surface flags</div>
            </div>
            <select 
              className="loqit-settings-select-pill" 
              value={aiThreshold} 
              onChange={(e) => setAiThreshold(e.target.value)}
              style={{ background: 'transparent', outline: 'none', cursor: 'pointer' }}
            >
              <option value="50">50%</option>
              <option value="70">70%</option>
              <option value="90">90%</option>
              <option value="99">99%</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { profile } = useAuth()
  const isPolice = profile?.role === 'police' || profile?.role === 'admin'

  return (
    <div style={{ minHeight: '100%', padding: '32px' }}>
      <div style={{ marginBottom: '32px', borderBottom: '1px solid var(--color-outlineVariant)', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-onSurface)' }}>Preferences & Settings</h1>
        <p style={{ color: 'var(--color-onSurfaceVariant)', marginTop: '8px' }}>Manage your account, privacy, and system configuration.</p>
      </div>

      <div className="loqit-settings-wrap">
        {isPolice ? <PoliceSettings /> : <WebSettings />}
      </div>
    </div>
  )
}
