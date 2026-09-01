import { CSSProperties, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { auth } from '../lib/authClient'
import { Colors } from '../lib/colors'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  // Set when arriving from a reset email; absent when an already signed-in user
  // is simply changing their password.
  const [resetToken, setResetToken] = useState<string | null>(null)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset_token')
    if (token) {
      setResetToken(token)
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setLoading(true)
    setMessage(null)
    const { error } = resetToken
      ? await auth.resetPassword(resetToken, password)
      : await supabase.auth.updateUser({ password })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password updated! Redirecting you to sign in…' })
      setTimeout(() => {
        supabase.auth.signOut()
        navigate('/login', { replace: true })
      }, 2000)
    }
    setLoading(false)
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: '12px', fontSize: '15px',
    background: 'var(--color-surfaceContainer)', border: '1px solid var(--color-outlineVariant)',
    color: Colors.onSurface, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: Colors.background, padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%', maxWidth: '420px',
          background: 'var(--color-surfaceContainerLowest)',
          borderRadius: '24px', padding: '40px',
          border: '1px solid var(--color-outlineVariant)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '2px', marginBottom: '20px', color: Colors.onSurface }}>LOQIT</div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: Colors.onSurface, marginBottom: '8px' }}>
            Set New Password
          </h1>
          <p style={{ color: Colors.onSurfaceVariant, fontSize: '14px' }}>
            Choose a strong password for your LOQIT account.
          </p>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
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

        {!ready ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: Colors.onSurfaceVariant }}>
            <span className="material-icons" style={{ fontSize: '40px', animation: 'spin 1s linear infinite', display: 'block', marginBottom: '12px', color: Colors.primary }}>sync</span>
            Verifying your reset link…
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: Colors.onSurfaceVariant, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <span className="material-icons" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: Colors.outline }}>lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  style={{ ...inputStyle, paddingLeft: '44px', paddingRight: '44px' }}
                  onFocus={e => e.currentTarget.style.borderColor = Colors.primary}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--color-outlineVariant)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: Colors.outline, padding: '4px' }}
                >
                  <span className="material-icons" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: Colors.onSurfaceVariant, marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <span className="material-icons" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: Colors.outline }}>lock_reset</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingLeft: '44px' }}
                  onFocus={e => e.currentTarget.style.borderColor = Colors.primary}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--color-outlineVariant)'}
                />
              </div>
              {confirm && password !== confirm && (
                <p style={{ fontSize: '12px', color: Colors.error, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>error</span>
                  Passwords don't match
                </p>
              )}
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
                color: Colors.onPrimary,
                fontSize: '16px', fontWeight: 700, marginTop: '8px',
                opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {loading
                ? <><span className="material-icons" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>sync</span> Updating…</>
                : <><span className="material-icons" style={{ fontSize: '20px' }}>lock_reset</span> Set New Password</>
              }
            </motion.button>
          </form>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: Colors.outline, cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>arrow_back</span>
            Back to Sign In
          </button>
        </div>
      </motion.div>
    </div>
  )
}
