import { useEffect, useRef, useState, CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Colors } from '../lib/colors'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'

/* ── Animated mesh background ───────────────────────── */
function MeshBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            x: [0, 40 * (i % 2 === 0 ? 1 : -1), 0],
            y: [0, 30 * (i % 3 === 0 ? 1 : -1), 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: i * 1.2 }}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            filter: 'blur(60px)',
            opacity: 0.35,
            width: [500, 400, 600, 350, 450, 500][i],
            height: [500, 400, 600, 350, 450, 500][i],
            background: [Colors.primary, Colors.secondary, Colors.accent, Colors.tertiary, Colors.primary, Colors.secondary][i],
            top: ['−10%', '60%', '20%', '80%', '40%', '−5%'][i],
            left: ['−5%', '70%', '50%', '−10%', '80%', '30%'][i],
          }}
        />
      ))}
    </div>
  )
}

/* ── Floating device card ───────────────────────────── */
function FloatingDevice({ x, y, delay, size = 56 }: { x: string; y: string; delay: number; size?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, y: [0, -12, 0] }}
      transition={{ opacity: { delay, duration: 0.6 }, scale: { delay, duration: 0.6 }, y: { delay, duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
      style={{
        position: 'absolute', left: x, top: y,
        width: size, height: size * 1.7,
        background: `linear-gradient(160deg, ${Colors.surfaceContainerHighest}, ${Colors.surfaceContainerHigh})`,
        borderRadius: size * 0.22,
        border: `1.5px solid color-mix(in srgb, ${Colors.primary} 27%, transparent)`,
        boxShadow: `0 0 30px color-mix(in srgb, ${Colors.primary} 19%, transparent), inset 0 1px 0 var(--color-outlineVariant)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span className="material-icons" style={{ fontSize: size * 0.42, color: `color-mix(in srgb, ${Colors.primary} 80%, transparent)` }}>smartphone</span>
    </motion.div>
  )
}

/* ── BLE ping ring ──────────────────────────────────── */
function BLEPing({ cx, cy, delay }: { cx: string; cy: string; delay: number }) {
  return (
    <motion.div
      style={{
        position: 'absolute', left: cx, top: cy, transform: 'translate(-50%,-50%)',
        width: 120, height: 120, borderRadius: '50%',
        border: `1px solid ${Colors.secondary}`,
        pointerEvents: 'none',
      }}
      animate={{ scale: [0.3, 2.5], opacity: [0.8, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay }}
    />
  )
}

/* ── Stat pill ──────────────────────────────────────── */
function StatPill({ icon, label, value, delay }: { icon: string; label: string; value: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px', padding: '12px 18px',
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: '10px', background: `color-mix(in srgb, ${Colors.primary} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-icons" style={{ fontSize: '20px', color: Colors.primary }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: Colors.onSurface }}>{value}</div>
        <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>{label}</div>
      </div>
    </motion.div>
  )
}

/* ── Main LoginPage ─────────────────────────────────── */
export function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signUp, verifyOtp, resendOtp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'civilian' | 'police'>('civilian')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showOtpVerify, setShowOtpVerify] = useState(false)
  const [otpToken, setOtpToken] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [stats, setStats] = useState({ devices: 0, recovered: 0, users: 0 })

  useEffect(() => {
    const load = async () => {
      const [d, r, u] = await Promise.all([
        supabase.from('devices').select('*', { count: 'exact', head: true }),
        supabase.from('devices').select('*', { count: 'exact', head: true }).in('status', ['found', 'recovered']),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'civilian'),
      ])
      setStats({ devices: d.count || 0, recovered: r.count || 0, users: u.count || 0 })
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      if (isSignUp) {
        // Client-side validation: Password Strength
        if (password.length < 8) throw new Error('Password must be at least 8 characters.')
        if (!/[A-Z]/.test(password)) throw new Error('Password must contain an uppercase letter.')
        if (!/[a-z]/.test(password)) throw new Error('Password must contain a lowercase letter.')
        if (!/[0-9]/.test(password)) throw new Error('Password must contain a number.')
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) throw new Error('Password must contain a special symbol.')

        // Client-side validation: Phone Number
        const cleanId = identifier.replace(/[\s\-\+]/g, '')
        const isPhone = /^\d+$/.test(cleanId)
        if (isPhone && cleanId.length !== 10 && cleanId.length !== 12) {
          throw new Error('Phone number must be exactly 10 digits.')
        }

        const { error } = await signUp(identifier, password, fullName)
        if (error) throw error
        setMessage({ type: 'success', text: 'Account created! Please check your email/SMS for the OTP to verify.' })
        setShowOtpVerify(true)
      } else {
        const { error } = await signIn(identifier, password)
        if (error) throw error
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) throw new Error('Sign in succeeded but session was not created.')
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single()
        if (mode === 'police') {
          if (profile?.role !== 'police' && profile?.role !== 'admin') {
            await supabase.auth.signOut()
            throw new Error('Access denied. Police credentials required.')
          }
          navigate('/police')
        } else {
          if (profile?.role === 'police' || profile?.role === 'admin') {
            await supabase.auth.signOut()
            throw new Error('Please use the Police portal to sign in.')
          }
          navigate('/dashboard')
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'An error occurred' })
    } finally { setLoading(false) }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await verifyOtp(identifier, otpToken)
      if (error) throw error
      setShowOtpVerify(false)
      setIsSignUp(false)
      // Navigate to dashboard after successful verification (session is now active)
      navigate('/dashboard')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Invalid OTP' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await resendOtp(identifier)
      if (error) throw error
      setMessage({ type: 'success', text: 'A new OTP has been sent to your email/phone.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Could not resend OTP.' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setMessage(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: `Password reset email sent to ${forgotEmail}. Check your inbox!` })
      setForgotEmail('')
    }
    setLoading(false)
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: '12px', fontSize: '15px',
    background: 'var(--color-surfaceContainer)', border: '1px solid var(--color-outlineVariant)',
    color: Colors.onSurface, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  }

  const features = [
    { icon: 'bluetooth', text: 'BLE background detection' },
    { icon: 'psychology', text: 'AI-powered risk scoring' },
    { icon: 'chat_bubble', text: 'Anonymous secure chat' },
    { icon: 'local_police', text: 'Police command center' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: Colors.background, position: 'relative', overflow: 'hidden' }}>
      <MeshBackground />

      <ThemeToggle style={{ position: 'fixed', top: 24, right: 32, zIndex: 100 }} />

      {/* ── Left panel ── */}
      <div style={{
        flex: '0 0 55%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 64px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* BLE rings */}
        <BLEPing cx="30%" cy="40%" delay={0} />
        <BLEPing cx="65%" cy="60%" delay={1.2} />
        <BLEPing cx="80%" cy="25%" delay={2.4} />

        {/* Floating phones */}
        <FloatingDevice x="72%" y="8%" delay={0.3} size={44} />
        <FloatingDevice x="82%" y="55%" delay={0.6} size={36} />
        <FloatingDevice x="62%" y="75%" delay={0.9} size={50} />

        {/* Brand */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '40px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <img src="/logo.png" alt="LOQIT" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
          </div>

          <h1 style={{ fontSize: '42px', fontWeight: 900, lineHeight: 1.15, marginBottom: '16px', color: Colors.onSurface }}>
            Protect &<br />
            <span style={{ background: `linear-gradient(90deg, ${Colors.primary}, ${Colors.secondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Recover
            </span><br />
            Your Device
          </h1>
          <p style={{ fontSize: '16px', color: Colors.onSurfaceVariant, lineHeight: 1.7, marginBottom: '40px', maxWidth: '420px' }}>
            The most advanced phone recovery platform in India.
            BLE detection, anonymous chat, AI risk scoring, and a police command centre — all in one system.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
            {features.map((f, i) => (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: `color-mix(in srgb, ${Colors.secondary} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-icons" style={{ fontSize: '18px', color: Colors.secondary }}>{f.icon}</span>
                </div>
                <span style={{ fontSize: '14px', color: Colors.onSurfaceVariant }}>{f.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Live stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <StatPill icon="devices" label="Devices Registered" value={stats.devices.toString()} delay={0.8} />
            <StatPill icon="check_circle" label="Recovered" value={stats.recovered.toString()} delay={0.9} />
            <StatPill icon="people" label="Users" value={stats.users.toString()} delay={1.0} />
          </div>
        </motion.div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        flex: '0 0 45%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px',
        background: 'var(--color-surfaceContainerLowest)',
        borderLeft: '1px solid var(--color-outlineVariant)',
        position: 'relative',
      }}>
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: '100%', maxWidth: '400px' }}
        >
          {/* Mode tabs */}
          <div style={{ display: 'flex', marginBottom: '36px', background: 'var(--color-surfaceContainer)', borderRadius: '16px', padding: '4px', border: '1px solid var(--color-outlineVariant)' }}>
            {(['civilian', 'police'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setMessage(null); setIsSignUp(false); setShowOtpVerify(false); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 700, transition: 'all 0.25s ease',
                  background: mode === m
                    ? (m === 'police' ? `linear-gradient(135deg, ${Colors.error}, #c44)` : `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`)
                    : 'transparent',
                  color: mode === m ? (m === 'police' ? '#fff' : Colors.onPrimary) : Colors.onSurfaceVariant,
                  boxShadow: mode === m ? `0 4px 20px ${m === 'police' ? Colors.error : Colors.primary}40` : 'none',
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>
                  {m === 'police' ? 'local_police' : 'person'}
                </span>
                {m === 'civilian' ? 'Civilian' : 'Police Portal'}
              </button>
            ))}
          </div>

          {/* Portal badge */}
          <AnimatePresence mode="wait">
            <motion.div
              key={showOtpVerify ? 'verify' : mode}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              style={{ marginBottom: '28px' }}
            >
              <div style={{ fontSize: '26px', fontWeight: 800, color: Colors.onSurface, marginBottom: '6px' }}>
                {showOtpVerify ? 'Verify your email' : mode === 'police' ? 'Law Enforcement Access' : isSignUp ? 'Create Account' : 'Welcome back'}
              </div>
              <div style={{ fontSize: '14px', color: Colors.onSurfaceVariant }}>
                {showOtpVerify
                  ? 'We sent a 6-digit OTP to your email or phone.'
                  : mode === 'police'
                  ? 'Authorised personnel only. Access is logged.'
                  : isSignUp
                  ? 'Join LOQIT and protect your devices'
                  : 'Sign in to your LOQIT account'}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Message */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                style={{
                  padding: '12px 16px', borderRadius: '12px', marginBottom: '20px',
                  fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                  background: message.type === 'error' ? `${Colors.error}18` : `${Colors.secondary}18`,
                  border: `1px solid ${message.type === 'error' ? Colors.error : Colors.secondary}44`,
                  color: message.type === 'error' ? Colors.error : Colors.secondary,
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px', flexShrink: 0 }}>
                  {message.type === 'error' ? 'error' : 'check_circle'}
                </span>
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forgot Password Form */}
          {showForgotPassword && (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: Colors.onSurfaceVariant, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Email</label>
                <div style={{ position: 'relative' }}>
                  <span className="material-icons" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: Colors.outline }}>email</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    style={{ ...inputStyle, paddingLeft: '44px' }}
                    onFocus={e => e.currentTarget.style.borderColor = Colors.primary}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--color-outlineVariant)'}
                  />
                </div>
              </div>
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                style={{
                  width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`,
                  color: Colors.onPrimary, fontSize: '16px', fontWeight: 700,
                  opacity: loading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {loading
                  ? <><span className="material-icons" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>sync</span> Sending…</>
                  : <><span className="material-icons" style={{ fontSize: '20px' }}>send</span> Send Reset Link</>
                }
              </motion.button>
              <div style={{ textAlign: 'center', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setMessage(null) }}
                  style={{ background: 'none', border: 'none', color: Colors.primary, cursor: 'pointer', fontSize: '14px', fontWeight: 700, padding: 0 }}
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Form */}
          {!showForgotPassword && <form onSubmit={showOtpVerify ? handleVerifyOtp : handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {showOtpVerify ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: Colors.onSurfaceVariant, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OTP Code</label>
                <div style={{ position: 'relative' }}>
                  <span className="material-icons" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: Colors.outline }}>dialpad</span>
                  <input placeholder="123456" value={otpToken} onChange={e => setOtpToken(e.target.value)} required style={{ ...inputStyle, paddingLeft: '44px', letterSpacing: '2px', fontWeight: 600 }} onFocus={e => e.currentTarget.style.borderColor = Colors.primary} onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'} maxLength={6} />
                </div>
                <div style={{ marginTop: '12px', textAlign: 'right' }}>
                  <button type="button" onClick={handleResendOtp} disabled={loading} style={{ background: 'none', border: 'none', color: Colors.primary, cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}>
                    Resend OTP
                  </button>
                </div>
              </motion.div>
            ) : (
              <>
                {isSignUp && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: Colors.onSurfaceVariant, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</label>
                    <div style={{ position: 'relative' }}>
                      <span className="material-icons" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: Colors.outline }}>person</span>
                <input placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} required style={{ ...inputStyle, paddingLeft: '44px' }} onFocus={e => e.currentTarget.style.borderColor = Colors.primary} onBlur={e => e.currentTarget.style.borderColor = 'var(--color-outlineVariant)'} />
              </div>
            </motion.div>
          )}

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: Colors.onSurfaceVariant, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email or Phone Number</label>
            <div style={{ position: 'relative' }}>
              <span className="material-icons" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: Colors.outline }}>contact_mail</span>
              <input type="text" placeholder="you@example.com or 9876543210" value={identifier} onChange={e => setIdentifier(e.target.value)} required style={{ ...inputStyle, paddingLeft: '44px' }} onFocus={e => e.currentTarget.style.borderColor = Colors.primary} onBlur={e => e.currentTarget.style.borderColor = 'var(--color-outlineVariant)'} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setMessage(null) }}
                  style={{ background: 'none', border: 'none', color: Colors.primary, cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0 }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <span className="material-icons" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: Colors.outline }}>lock</span>
              <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ ...inputStyle, paddingLeft: '44px', paddingRight: '44px' }} onFocus={e => e.currentTarget.style.borderColor = Colors.primary} onBlur={e => e.currentTarget.style.borderColor = 'var(--color-outlineVariant)'} />
              <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: Colors.outline, padding: '4px' }}>
                <span className="material-icons" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
        style={{
          width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: mode === 'police'
            ? `linear-gradient(135deg, ${Colors.error}, #c44)`
            : `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`,
          color: mode === 'police' ? '#fff' : Colors.onPrimary,
          fontSize: '16px', fontWeight: 700, marginTop: '8px',
          boxShadow: `0 8px 24px color-mix(in srgb, ${mode === 'police' ? Colors.error : Colors.primary} 31%, transparent)`,
                opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {loading ? (
                <><span className="material-icons" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>sync</span> Processing…</>
              ) : showOtpVerify ? (
                <><span className="material-icons" style={{ fontSize: '20px' }}>check_circle</span> Verify OTP</>
              ) : (
                <><span className="material-icons" style={{ fontSize: '20px' }}>{isSignUp ? 'person_add' : mode === 'police' ? 'badge' : 'login'}</span>
                {isSignUp ? 'Create Account' : mode === 'police' ? 'Access Police Portal' : 'Sign In'}</>
              )}
            </motion.button>
          </form>}

          {/* Divider + Google + Toggle */}
          {!showForgotPassword && mode === 'civilian' && !showOtpVerify && (
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-outlineVariant)', opacity: 0.5 }} />
                <span style={{ fontSize: '12px', color: Colors.outline, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>or continue with</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-outlineVariant)', opacity: 0.5 }} />
              </div>

              <motion.button
                type="button"
                onClick={handleGoogleSignIn}
                whileHover={{ scale: 1.02, backgroundColor: 'var(--color-surfaceContainerHigh)' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%', padding: '12px', borderRadius: '14px',
                  background: 'var(--color-surfaceContainer)',
                  border: '1px solid var(--color-outlineVariant)',
                  color: Colors.onSurface, fontSize: '15px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                  cursor: 'pointer', marginBottom: '24px', transition: 'background-color 0.2s',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Google Account
              </motion.button>

              <span style={{ fontSize: '14px', color: Colors.onSurfaceVariant }}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </span>
              <button
                type="button"
                onClick={() => { setIsSignUp(s => !s); setMessage(null) }}
                style={{ background: 'none', border: 'none', color: Colors.primary, cursor: 'pointer', fontSize: '14px', fontWeight: 700, padding: 0 }}
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          )}

          {showOtpVerify && (
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setShowOtpVerify(false); setIsSignUp(false); }}
                style={{ background: 'none', border: 'none', color: Colors.primary, cursor: 'pointer', fontSize: '14px', fontWeight: 700, padding: 0 }}
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Back link */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: Colors.outline, cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px' }}>arrow_back</span>
              Back to home
            </button>
          </div>

          {mode === 'police' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                marginTop: '20px', padding: '14px 16px', borderRadius: '12px',
                background: `color-mix(in srgb, ${Colors.error} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${Colors.error} 20%, transparent)`,
                display: 'flex', gap: '10px', alignItems: 'flex-start',
              }}
            >
              <span className="material-icons" style={{ fontSize: '18px', color: Colors.error, flexShrink: 0, marginTop: '1px' }}>shield</span>
              <p style={{ fontSize: '12px', color: Colors.onSurfaceVariant, margin: 0, lineHeight: 1.6 }}>
                This portal is restricted to verified law enforcement. All access attempts are logged and audited.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
