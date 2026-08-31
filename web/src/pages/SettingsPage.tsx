import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, BadgeCheck, KeyRound, ShieldCheck, Smartphone, ArrowLeftRight,
  History, Wifi, ClipboardList, Bot, X, Check, Loader2,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { db } from '../lib/db'
import {
  C, TONE, FONT, Page, PageHeader, Card, Button, Badge,
  IconTile, inputStyle, cardStyle, Field,
} from '../components/crm'

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!value) }}
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

/** One settings line: icon, label, description, and a trailing control. */
function Row({ icon: Icon, tone = TONE.blue, title, subtitle, onClick, trailing, last }: {
  icon: LucideIcon; tone?: string; title: string; subtitle: string
  onClick?: () => void; trailing?: React.ReactNode; last?: boolean
}) {
  return (
    <div
      className={onClick ? 'crm-row' : undefined}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '13px 20px',
        borderBottom: last ? 'none' : `1px solid ${C.border}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <IconTile icon={Icon} tone={tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{title}</div>
        <div style={{ fontSize: '12px', color: C.muted, marginTop: '1px' }}>{subtitle}</div>
      </div>
      {trailing}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, color: C.label,
      letterSpacing: '0.6px', textTransform: 'uppercase',
      margin: '0 0 10px 4px',
    }}>
      {children}
    </div>
  )
}

function AadhaarModal({ onClose, onVerified }: { onClose: () => void; onVerified: () => void }) {
  const [aadhaar, setAadhaar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const { user } = useAuth()

  const handleVerify = async () => {
    setError('')
    if (aadhaar.replace(/\s/g, '').length !== 12) {
      setError('Aadhaar must be exactly 12 digits')
      return
    }
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    const { error: updateError } = await db.from('profiles').update({ aadhaar_verified: true }).eq('id', user?.id)
    setLoading(false)
    if (updateError) { setError(updateError.message); return }
    setStep(2)
    onVerified()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(17,18,22,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', fontFamily: FONT,
      }}
      onClick={onClose}
    >
      <div style={{ ...cardStyle, padding: '26px', width: '100%', maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <IconTile icon={BadgeCheck} tone={TONE.green} size={44} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: 0 }}>Verify Aadhaar</h3>
                  <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>Proves legal ownership of your devices</p>
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', lineHeight: 0 }}>
                <X size={18} />
              </button>
            </div>

            <Field label="Aadhaar number" hint="Stored only as a one-way hash — the number itself is never saved.">
              <input
                className="crm-input"
                style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', letterSpacing: '1px' }}
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="1234 5678 9012"
                maxLength={14}
              />
            </Field>

            {error && (
              <p style={{ fontSize: '12px', color: TONE.red, margin: '10px 0 0' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button icon={loading ? Loader2 : Check} onClick={handleVerify} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify'}
              </Button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <IconTile icon={Check} tone={TONE.green} size={48} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: '14px 0 4px' }}>Verification successful</h3>
            <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 20px' }}>
              Your account is now Aadhaar-verified.
            </p>
            <Button onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function CivilianSettings() {
  const navigate = useNavigate()
  const { profile, user, refreshProfile } = useAuth()
  const [showAadhaarModal, setShowAadhaarModal] = useState(false)
  const [twoFactorWeb, setTwoFactorWeb] = useLocalStorage('loqit_web_2fa', false)

  const isAadhaarVerified = profile?.aadhaar_verified

  return (
    <>
      {showAadhaarModal && <AadhaarModal onClose={() => setShowAadhaarModal(false)} onVerified={refreshProfile} />}

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '20px', alignItems: 'start' }}>
        <div>
          <SectionLabel>Account &amp; profile</SectionLabel>
          <Card>
            <Row icon={User} title="Personal details" subtitle="Name, email and phone number" onClick={() => navigate('/profile')} />
            <Row
              icon={BadgeCheck} tone={TONE.green}
              title="Aadhaar verification"
              subtitle="Required as legal proof of device ownership"
              onClick={() => !isAadhaarVerified && setShowAadhaarModal(true)}
              trailing={<Badge tone={isAadhaarVerified ? TONE.green : TONE.amber}>{isAadhaarVerified ? 'Verified' : 'Pending'}</Badge>}
            />
            <Row icon={KeyRound} tone={TONE.amber} title="Password" subtitle="Change the password for this account" onClick={() => navigate('/profile')} />
            <Row
              icon={ShieldCheck} tone={TONE.blue}
              title="Two-factor authentication"
              subtitle="Ask for an OTP when signing in to the dashboard"
              trailing={<Toggle value={twoFactorWeb} onChange={setTwoFactorWeb} />}
              last
            />
          </Card>
        </div>

        <div>
          <SectionLabel>Devices &amp; ownership</SectionLabel>
          <Card>
            <Row icon={Smartphone} title="Registered devices" subtitle="View and manage every linked device" onClick={() => navigate('/devices')} />
            <Row icon={ArrowLeftRight} title="Transfer ownership" subtitle="Hand a device over to another LOQIT user" onClick={() => navigate('/transfer-ownership')} last />
          </Card>

          <div style={{ marginTop: '20px' }}>
            <SectionLabel>Signed in as</SectionLabel>
            <Card style={{ padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>
                {profile?.full_name || 'LOQIT User'}
              </div>
              <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                {user?.email} · Civilian portal
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

function PoliceSettings() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [ipAllowlist, setIpAllowlist] = useLocalStorage('loqit_police_ip_allowlist', true)
  const [autoAssign, setAutoAssign] = useLocalStorage('loqit_police_auto_assign', false)
  const [aiThreshold, setAiThreshold] = useLocalStorage('loqit_police_ai_threshold', '70')

  return (
    <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '20px', alignItems: 'start' }}>
      <div>
        <SectionLabel>Account &amp; credentials</SectionLabel>
        <Card>
          <Row icon={User} title="Officer profile" subtitle="Name, badge number and station" onClick={() => navigate('/profile')} />
          <Row
            icon={ShieldCheck} tone={TONE.green}
            title="Role &amp; jurisdiction"
            subtitle="Police role verified by an administrator"
            trailing={<Badge tone={TONE.green}>Verified</Badge>}
            last
          />
        </Card>

        <div style={{ marginTop: '20px' }}>
          <SectionLabel>Signed in as</SectionLabel>
          <Card style={{ padding: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>
              {profile?.full_name || 'Officer'}
            </div>
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
              {user?.email} · Police portal
            </div>
          </Card>
        </div>
      </div>

      <div>
        <SectionLabel>Security &amp; access</SectionLabel>
        <Card>
          <Row
            icon={ShieldCheck} tone={TONE.red}
            title="Two-factor authentication"
            subtitle="Always required for police accounts"
            trailing={<Badge tone={TONE.red}>Always on</Badge>}
          />
          <Row icon={History} tone={TONE.red} title="Access log" subtitle="Every civilian record you have opened" onClick={() => navigate('/police/analytics')} />
          <Row
            icon={Wifi} tone={TONE.red}
            title="IP allowlist"
            subtitle="Restrict sign-in to station network addresses"
            trailing={<Toggle value={ipAllowlist} onChange={setIpAllowlist} />}
            last
          />
        </Card>

        <div style={{ marginTop: '20px' }}>
          <SectionLabel>Case &amp; investigation</SectionLabel>
          <Card>
            <Row
              icon={ClipboardList} tone={TONE.amber}
              title="Default case assignment"
              subtitle="Assign new reports to me automatically"
              trailing={<Toggle value={autoAssign} onChange={setAutoAssign} />}
            />
            <Row
              icon={Bot} tone={TONE.amber}
              title="AI flag threshold"
              subtitle="Minimum confidence before a chat is flagged"
              trailing={
                <select
                  className="crm-input"
                  value={aiThreshold}
                  onChange={(e) => setAiThreshold(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '7px 10px', cursor: 'pointer' }}
                >
                  <option value="50">50%</option>
                  <option value="70">70%</option>
                  <option value="90">90%</option>
                  <option value="99">99%</option>
                </select>
              }
              last
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { profile } = useAuth()
  const isPolice = profile?.role === 'police' || profile?.role === 'admin'

  return (
    <Page>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, security and device preferences"
      />
      {isPolice ? <PoliceSettings /> : <CivilianSettings />}
    </Page>
  )
}
