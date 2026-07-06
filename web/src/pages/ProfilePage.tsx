import { CSSProperties, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Colors } from '../lib/colors'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { useDevices } from '../hooks/useDevices'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input } from '../components/Input'


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
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      await refreshProfile()
      setTimeout(() => setIsEditing(false), 1500)
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

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password changed successfully!' })
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

  const getInitials = () => {
    const name = profile?.full_name || 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px', padding: '24px', backgroundColor: Colors.surfaceContainer, borderRadius: '12px', border: `1px solid ${Colors.outlineVariant}` }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px', flexShrink: 0,
            background: `linear-gradient(135deg, ${Colors.primary} 0%, ${Colors.accent} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 800, color: 'white',
            boxShadow: `0 4px 16px ${Colors.primary}40`,
          }}>
            {getInitials()}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: Colors.onSurface, margin: '0 0 4px' }}>
            {profile?.full_name || 'User Profile'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', color: Colors.onSurfaceVariant, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px' }}>alternate_email</span>
              {user?.email}
            </span>
            <span style={{ fontSize: '12px', color: Colors.primary, backgroundColor: `${Colors.primary}15`, padding: '3px 10px', borderRadius: '10px', fontWeight: 600 }}>
              Member since {new Date(profile?.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Compact Stats */}
        <div style={{ display: 'flex', gap: '32px' }}>
          {[
            { label: 'Devices', value: devices.length, icon: 'devices', color: Colors.primary },
            { label: 'Reports', value: reportsCount, icon: 'security', color: Colors.error },
            { label: 'Protected', value: devices.filter(d => d.status === 'registered').length, icon: 'verified_user', color: Colors.secondary },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: Colors.onSurfaceVariant, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(450px, 100%), 1fr))', gap: '40px' }}>
        
        {/* Profile Info Section */}
        <motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${Colors.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-icons" style={{ color: Colors.primary }}>person</span>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Information</h2>
          </div>
          
          <Card variant="elevated" style={{ padding: '32px', borderRadius: '24px', border: `1px solid ${Colors.outlineVariant}` }}>
            <AnimatePresence mode="wait">
              {message.text && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ 
                  padding: '16px', borderRadius: '12px', marginBottom: '24px',
                  background: message.type === 'error' ? `${Colors.error}15` : `${Colors.secondary}15`,
                  color: message.type === 'error' ? Colors.error : Colors.secondary,
                  border: `1px solid ${message.type === 'error' ? Colors.error : Colors.secondary}30`,
                  display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600
                }}>
                  <span className="material-icons" style={{ fontSize: '20px' }}>{message.type === 'error' ? 'error' : 'check_circle'}</span>
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input label="FULL NAME" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                <Input label="PHONE NUMBER" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 890" />
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <Button type="submit" loading={loading} icon="save" fullWidth>SAVE</Button>
                  <Button variant="ghost" onClick={() => setIsEditing(false)} style={{ border: `1.5px solid ${Colors.outlineVariant}` }}>CANCEL</Button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${Colors.outlineVariant}`, paddingBottom: '16px' }}>
                  <span style={{ color: Colors.onSurfaceVariant, fontWeight: 600 }}>Name</span>
                  <span style={{ color: Colors.onSurface, fontWeight: 700 }}>{profile?.full_name || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${Colors.outlineVariant}`, paddingBottom: '16px' }}>
                  <span style={{ color: Colors.onSurfaceVariant, fontWeight: 600 }}>Email</span>
                  <span style={{ color: Colors.onSurface, fontWeight: 700 }}>{user?.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${Colors.outlineVariant}`, paddingBottom: '16px' }}>
                  <span style={{ color: Colors.onSurfaceVariant, fontWeight: 600 }}>Phone</span>
                  <span style={{ color: Colors.onSurface, fontWeight: 700 }}>{profile?.phone_number || 'Not Set'}</span>
                </div>
                <Button onClick={() => setIsEditing(true)} icon="edit" fullWidth variant="ghost" style={{ border: `1.5px solid ${Colors.primary}`, color: Colors.primary }}>
                    EDIT PROFILE
                </Button>
              </div>
            )}
          </Card>
        </motion.section>

        {/* Security & Actions Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <motion.section initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${Colors.error}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-icons" style={{ color: Colors.error }}>security</span>
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Security</h2>
                </div>
                
                <Card variant="elevated" style={{ padding: '32px', borderRadius: '24px', border: `1px solid ${Colors.outlineVariant}` }}>
                    {isChangingPassword ? (
                        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <Input label="NEW PASSWORD" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                            <Input label="CONFIRM PASSWORD" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                <Button type="submit" loading={loading} variant="primary" icon="lock" fullWidth>UPDATE</Button>
                                <Button variant="ghost" onClick={() => setIsChangingPassword(false)} style={{ border: `1.5px solid ${Colors.outlineVariant}` }}>CANCEL</Button>
                            </div>
                        </form>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ color: Colors.onSurfaceVariant, marginBottom: '24px', fontSize: '14px', lineHeight: 1.6 }}>Keep your account secure by using a strong, unique password.</p>
                            <Button onClick={() => setIsChangingPassword(true)} icon="password" variant="ghost" style={{ border: `1.5px solid ${Colors.outlineVariant}` }} fullWidth>
                                CHANGE PASSWORD
                            </Button>
                        </div>
                    )}
                </Card>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-icons" style={{ color: Colors.onSurfaceVariant }}>settings</span>
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Preferences</h2>
                </div>
                <Card variant="elevated" style={{ padding: '24px', borderRadius: '24px', border: `1.5px dashed ${Colors.outlineVariant}`, background: 'transparent' }}>
                    <Button onClick={handleSignOut} variant="danger" icon="logout" fullWidth style={{ borderRadius: '16px' }}>
                        SIGN OUT
                    </Button>
                </Card>
            </motion.section>
        </div>

      </div>
    </div>
  )
}
