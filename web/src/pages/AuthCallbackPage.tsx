import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Colors } from '../lib/colors'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    let done = false
    let subscription: { unsubscribe: () => void } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const routeForUser = async (userId: string) => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      if (subscription) subscription.unsubscribe()

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profile?.role === 'police' || profile?.role === 'admin') {
        navigate('/police', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }

    const handleCallback = async () => {
      // 1. Subscribe FIRST so a SIGNED_IN event fired during the PKCE exchange
      //    can never slip through the race window unobserved.
      const sub = supabase.auth.onAuthStateChange((event, s) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && s?.user) {
          routeForUser(s.user.id)
        }
      })
      subscription = sub.data.subscription

      // 2. If the URL carries a PKCE ?code=, exchange it explicitly. This is
      //    idempotent with detectSessionInUrl and resolves the session reliably.
      try {
        if (window.location.search.includes('code=')) {
          await supabase.auth.exchangeCodeForSession(window.location.href)
        }
      } catch (err) {
        console.warn('Auth callback: code exchange failed (may already be handled):', err)
      }

      // 3. Catch the already-established-session case.
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Auth callback error:', error)
        if (!done) {
          done = true
          if (subscription) subscription.unsubscribe()
          navigate('/login?error=auth_failed', { replace: true })
        }
        return
      }
      if (session?.user) {
        routeForUser(session.user.id)
        return
      }

      // 4. Fallback: if nothing resolved, return to login after a short wait.
      timer = setTimeout(() => {
        if (done) return
        done = true
        if (subscription) subscription.unsubscribe()
        navigate('/login?error=timeout', { replace: true })
      }, 8000)
    }

    handleCallback()

    return () => {
      if (timer) clearTimeout(timer)
      if (subscription) subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.background,
      gap: '20px',
    }}>
      <img src="/logo.png" alt="LOQIT" style={{ height: '64px', width: 'auto', marginBottom: '8px' }} />
      <span
        className="material-icons"
        style={{ fontSize: '48px', color: Colors.primary, animation: 'spin 1s linear infinite' }}
      >
        sync
      </span>
      <p style={{ color: Colors.onSurfaceVariant, fontSize: '16px', margin: 0 }}>
        Signing you in…
      </p>
    </div>
  )
}
