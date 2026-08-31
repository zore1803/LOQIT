import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Mail, Phone, Smartphone, ShieldCheck, FileWarning, Pencil,
  KeyRound, LogOut, Check, AlertCircle, BadgeCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { useDevices } from '../hooks/useDevices'
import {
  C, TONE, FONT, Page, PageHeader, Card, CardHeader, Button, Badge,
  SummaryCard, Field, inputStyle,
} from '../components/crm'

export function ProfilePage() {
  const navigate = useNavigate()
  const { profile, user, signOut, refreshProfile } = useAuth()
  const { devices } = useDevices()
  const [reportsCount, setReportsCount] = useState(0)

  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone_number || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const loadReportsCount = async () => {
      if (!user?.id) return
      const { count } = await db
        .from('lost_reports')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
      setReportsCount(count ?? 0)
    }
    loadReportsCount()
  }, [user?.id])

  useEffect(() => {
    setFullName(profile?.full_name || '')
    setPhone(profile?.phone_number || '')
  }, [profile])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { error } = await db
      .from('profiles')
      .update({ full_name: fullName, phone_number: phone || null })
      .eq('id', user?.id)

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Profile updated.' })
      await refreshProfile()
      setTimeout(() => setIsEditing(false), 1200)
    }
    setLoading(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    // The API enforces 8 characters; match it here so the error arrives sooner.
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password changed. Signing you out of other devices.' })
      setTimeout(() => setIsChangingPassword(false), 1500)
      setNewPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = (() => {
    const name = profile?.full_name || 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  })()

  const roleLabel = profile?.role === 'police' ? 'Police Officer'
    : profile?.role === 'admin' ? 'Admin' : 'Civilian'

  const protectedCount = devices.filter(d => d.status === 'registered').length

  return (
    <Page>
      <PageHeader title="Profile" subtitle="Your account details and security settings" />

      {/* Identity */}
      <Card style={{ padding: '22px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '999px', flexShrink: 0,
            background: C.primary, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 600,
          }}>
            {initials}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.heading, margin: 0 }}>
                {profile?.full_name || 'LOQIT User'}
              </h2>
              <Badge tone={profile?.role === 'civilian' ? TONE.blue : TONE.green}>{roleLabel}</Badge>
              {profile?.aadhaar_verified && (
                <Badge tone={TONE.green}>Aadhaar verified</Badge>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: C.label }}>
                <Mail size={14} color={C.muted} /> {user?.email || '—'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: C.label }}>
                <Phone size={14} color={C.muted} /> {profile?.phone_number || 'No phone added'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {!isEditing && <Button variant="ghost" icon={Pencil} onClick={() => { setIsEditing(true); setMessage({ type: '', text: '' }) }}>Edit</Button>}
            <Button variant="ghost" icon={LogOut} onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="crm-c3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <SummaryCard label="Devices Registered" value={devices.length} icon={Smartphone} tone={TONE.blue} />
        <SummaryCard label="Currently Protected" value={protectedCount} icon={ShieldCheck} tone={TONE.green} />
        <SummaryCard label="Lost Reports Filed" value={reportsCount} icon={FileWarning} tone={reportsCount ? TONE.amber : TONE.grey} />
      </div>

      {/* Feedback */}
      {message.text && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '11px 16px', borderRadius: '12px', marginBottom: '20px',
          fontSize: '13px', fontWeight: 500, fontFamily: FONT,
          background: message.type === 'error' ? '#FEF2F2' : '#ECFDF5',
          border: `1px solid ${message.type === 'error' ? '#FECACA' : '#A7F3D0'}`,
          color: message.type === 'error' ? '#991B1B' : '#065F46',
        }}>
          {message.type === 'error' ? <AlertCircle size={15} /> : <Check size={15} />}
          {message.text}
        </div>
      )}

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '20px', alignItems: 'start' }}>

        {/* Account details */}
        <Card>
          <CardHeader title="Account Information" subtitle="How you appear across LOQIT" />
          <div style={{ padding: '0 24px 22px' }}>
            {isEditing ? (
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Full name">
                  <input className="crm-input" style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </Field>
                <Field label="Phone number" hint="Used so a finder can be connected to you without revealing your number.">
                  <input className="crm-input" style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
                </Field>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <Button type="submit" icon={Check} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</Button>
                  <Button variant="ghost" onClick={() => { setIsEditing(false); setMessage({ type: '', text: '' }) }}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div style={{ background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
                {[
                  { icon: User, label: 'Full name', value: profile?.full_name || '—' },
                  { icon: Mail, label: 'Email', value: user?.email || '—' },
                  { icon: Phone, label: 'Phone', value: profile?.phone_number || '—' },
                  { icon: BadgeCheck, label: 'Role', value: roleLabel },
                  { icon: ShieldCheck, label: 'Aadhaar', value: profile?.aadhaar_verified ? 'Verified' : 'Not verified' },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '11px 14px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${C.tileBorder}` : 'none',
                  }}>
                    <row.icon size={15} color={C.muted} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: C.label, flex: 1 }}>{row.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: C.heading, textAlign: 'right', wordBreak: 'break-all' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader title="Security" subtitle="Password and session controls" />
          <div style={{ padding: '0 24px 22px' }}>
            {isChangingPassword ? (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="New password" hint="At least 8 characters.">
                  <input className="crm-input" style={inputStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </Field>
                <Field label="Confirm new password">
                  <input className="crm-input" style={inputStyle} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </Field>
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px',
                  padding: '11px 14px', fontSize: '12px', color: '#92400E', lineHeight: 1.55,
                }}>
                  Changing your password signs you out on every other device.
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button type="submit" icon={Check} disabled={loading}>{loading ? 'Updating…' : 'Update password'}</Button>
                  <Button variant="ghost" onClick={() => { setIsChangingPassword(false); setMessage({ type: '', text: '' }) }}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px', background: C.tile,
                  border: `1px solid ${C.tileBorder}`, borderRadius: '12px',
                }}>
                  <KeyRound size={17} color={C.primary} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>Password</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '1px' }}>
                      Set a new password for this account
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => { setIsChangingPassword(true); setMessage({ type: '', text: '' }) }}>Change</Button>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px', background: C.tile,
                  border: `1px solid ${C.tileBorder}`, borderRadius: '12px',
                }}>
                  <LogOut size={17} color={TONE.red} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>Sign out</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '1px' }}>
                      End this session on this browser
                    </div>
                  </div>
                  <Button variant="ghost" onClick={handleSignOut}>Sign out</Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Page>
  )
}
