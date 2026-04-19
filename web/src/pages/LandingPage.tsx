import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { Colors } from '../lib/colors'
import { ThemeToggle } from '../components/ThemeToggle'
import { ParticleMorphCanvas } from '../components/ParticleMorphCanvas'

/* ─── BLE Particle Canvas ─────────────────────────────────────── */
function BLEParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    const dpr = window.devicePixelRatio || 1

    const rootStyles = getComputedStyle(document.documentElement)
    const getVar = (name: string, fallback: string) => rootStyles.getPropertyValue(name).trim() || fallback
    const cp = getVar('--color-primary', '#aac7ff')
    const cs = getVar('--color-secondary', '#46f1bb')
    const ct = getVar('--color-tertiary', '#ffb95f')
    const ca = getVar('--color-accent', '#3D8EFF')

    // ... rest of the setup
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string }
    const particles: Particle[] = []
    const rings: { r: number; alpha: number; speed: number }[] = [
      { r: 0, alpha: 0.8, speed: 0.6 },
      { r: 40, alpha: 0.5, speed: 0.5 },
      { r: 80, alpha: 0.3, speed: 0.4 },
    ]

    const spawnParticle = (cx: number, cy: number) => {
      const angle = Math.random() * Math.PI * 2
      const colors = [cp, cs, ct, ca]
      particles.push({
        x: cx + Math.cos(angle) * (20 + Math.random() * 30),
        y: cy + Math.sin(angle) * (20 + Math.random() * 30),
        vx: Math.cos(angle) * (0.3 + Math.random() * 0.8),
        vy: Math.sin(angle) * (0.3 + Math.random() * 0.8),
        life: 0,
        maxLife: 90 + Math.random() * 60,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    let frame = 0
    const animate = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      const cx = W / 2
      const cy = H / 2
      ctx.clearRect(0, 0, W, H)

      // Draw BLE rings
      rings.forEach((ring) => {
        ring.r += ring.speed
        const maxR = Math.min(W, H) * 0.45
        if (ring.r > maxR) { ring.r = 0; ring.alpha = 0.8 }
        ring.alpha = ring.alpha * 0.993
        ctx.globalAlpha = ring.alpha
        ctx.strokeStyle = cp
        ctx.lineWidth = 2
        ctx.stroke()
      })
      ctx.globalAlpha = 1

      // Spawn particles
      if (frame % 4 === 0) spawnParticle(cx, cy)

      // Draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life++
        const progress = p.life / p.maxLife
        const alpha = Math.sin(progress * Math.PI)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fill()
        if (p.life >= p.maxLife) particles.splice(i, 1)
      }
      ctx.globalAlpha = 1

      // Phone glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70)
      grd.addColorStop(0, cp)
      grd.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(cx, cy, 70, 0, Math.PI * 2)
      ctx.globalAlpha = 0.15
      ctx.fillStyle = grd
      ctx.fill()
      ctx.globalAlpha = 1

      frame++
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}

/* ─── Animated Counter ─────────────────────────────────────────── */
function Counter({ target, label, icon }: { target: number; label: string; icon: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!inView) return
    const duration = 1800
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    tick()
  }, [inView, target])

  return (
    <div ref={ref} style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--color-surfaceContainer)', borderRadius: '24px', border: '1px solid var(--color-outlineVariant)', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
      <span className="material-icons" style={{ fontSize: '32px', color: Colors.primary, marginBottom: '12px', display: 'block' }}>{icon}</span>
      <div style={{ fontSize: '48px', fontWeight: 800, color: Colors.onSurface, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>
        {count.toLocaleString()}
      </div>
      <div style={{ fontSize: '15px', color: Colors.onSurfaceVariant, marginTop: '4px', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

/* ─── Story Step ───────────────────────────────────────────────── */
function StoryStep({
  step, icon, title, desc, color, delay, align,
}: { step: string; icon: string; title: string; desc: string; color: string; delay: number; align: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: align === 'left' ? -60 : 60 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
        marginBottom: '64px',
      }}
    >
      <div style={{
        width: '80px', height: '80px', flexShrink: 0,
        borderRadius: '24px',
        background: `linear-gradient(135deg, ${color}33, ${color}11)`,
        border: `2px solid ${color}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 30px ${color}30`,
      }}>
        <span className="material-icons" style={{ fontSize: '36px', color }}>{icon}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          Step {step}
        </div>
        <h3 style={{ fontSize: '24px', fontWeight: 700, color: Colors.onSurface, marginBottom: '10px' }}>{title}</h3>
        <p style={{ fontSize: '16px', color: Colors.onSurfaceVariant, lineHeight: '1.6', margin: 0 }}>{desc}</p>
      </div>
    </motion.div>
  )
}

/* ─── Feature Card ─────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, color, delay }: { icon: string; title: string; desc: string; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? Colors.surfaceContainerHigh : Colors.surfaceContainerLow,
        border: `1px solid ${hovered ? color + '66' : Colors.outlineVariant}`,
        borderRadius: '20px',
        padding: '28px',
        transition: 'all 0.3s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 20px 40px ${color}20` : 'none',
        cursor: 'default',
      }}
    >
      <div style={{
        width: '52px', height: '52px', borderRadius: '16px',
        background: `${color}22`, border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <span className="material-icons" style={{ fontSize: '26px', color }}>{icon}</span>
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 700, color: Colors.onSurface, marginBottom: '10px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: Colors.onSurfaceVariant, lineHeight: '1.6', margin: 0 }}>{desc}</p>
    </motion.div>
  )
}

/* ─── Download Button ──────────────────────────────────────────── */
function DownloadBtn({ icon, label, sub, href, primary }: { icon: string; label: string; sub: string; href: string; primary?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '16px 28px',
        borderRadius: '16px',
        background: primary
          ? (hovered ? Colors.primaryContainer : Colors.primary)
          : (hovered ? Colors.surfaceContainerHigh : Colors.surfaceContainerLow),
        border: `1px solid ${primary ? Colors.primary : Colors.outlineVariant}`,
        color: primary ? Colors.onPrimary : Colors.onSurface,
        textDecoration: 'none',
        transition: 'all 0.25s ease',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        cursor: 'pointer',
      }}
    >
      <span className="material-icons" style={{ fontSize: '32px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '12px', opacity: 0.75 }}>{sub}</div>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>{label}</div>
      </div>
    </a>
  )
}


/* ─── Main Landing Page ────────────────────────────────────────── */
export function LandingPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ devices: 0, recovered: 0, users: 0, reports: 0 })

  useEffect(() => {
    const load = async () => {
      const [devRes, recRes, usrRes, repRes] = await Promise.all([
        supabase.from('devices').select('*', { count: 'exact', head: true }),
        supabase.from('devices').select('*', { count: 'exact', head: true }).in('status', ['found', 'recovered']),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'civilian'),
        supabase.from('lost_reports').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        devices: devRes.count || 0,
        recovered: recRes.count || 0,
        users: usrRes.count || 0,
        reports: repRes.count || 0,
      })
    }
    load()
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ background: Colors.background, color: Colors.onSurface, fontFamily: 'inherit', overflowX: 'hidden' }}>

      {/* ── Navbar (always visible) ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)', backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${Colors.outlineVariant}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '64px',
      }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <img src="/logo.png" alt="LOQIT" style={{ height: '34px', objectFit: 'contain', filter: 'var(--logo-filter)' }} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          {[['features', 'Features'], ['how-it-works', 'How It Works'], ['download', 'Download']].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', color: Colors.onSurfaceVariant, cursor: 'pointer', padding: '8px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
              {label}
            </button>
          ))}
          <ThemeToggle style={{ width: 38, height: 38, marginLeft: '8px' }} />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            style={{ background: `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`, color: Colors.onPrimary, border: 'none', borderRadius: '10px', padding: '9px 22px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', marginLeft: '8px', boxShadow: `0 4px 16px ${Colors.primary}40` }}
          >
            Sign In
          </motion.button>
        </motion.div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'row',
        alignItems: 'stretch', justifyContent: 'flex-start',
        position: 'relative', overflow: 'hidden',
        paddingTop: '64px', // navbar offset
      }}>
        {/* Subtle radial background gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 60% 80% at 20% 50%, color-mix(in srgb, ${Colors.primary} 10%, transparent) 0%, transparent 65%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* ── LEFT: Particle Morph Panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'relative',
            width: 'clamp(280px, 38vw, 560px)',
            flexShrink: 0,
            zIndex: 1,
            // Subtle inner panel
            background: 'transparent',
          }}
        >
          {/* BLE Particle Canvas — ambient background placed BEHIND the morph text */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none', zIndex: -2 }}>
            <BLEParticleCanvas />
          </div>
          
          {/* Logo Pattern placed BEHIND the text */}
          <div style={{
            position: 'absolute',
            inset: '5%',
            backgroundImage: 'url(/logo-pattern.png)',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.22,
            filter: 'var(--logo-filter)',
            pointerEvents: 'none',
            zIndex: -1
          }} />

          {/* Canvas fills the panel */}
          <ParticleMorphCanvas
            particleCount={2800}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
            }}
          />



          {/* Vertical divider line — right edge of left panel */}
          <div style={{
            position: 'absolute',
            right: 0, top: '10%', bottom: '10%',
            width: '1px',
            background: `linear-gradient(to bottom, transparent, ${Colors.primary}55, transparent)`,
            pointerEvents: 'none',
          }} />
        </motion.div>

        {/* ── RIGHT: Hero text ── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: 'clamp(24px, 5vw, 80px) clamp(24px, 5vw, 72px)',
            position: 'relative',
            zIndex: 1,
          }}
        >

          <div style={{ position: 'relative', zIndex: 2, maxWidth: '620px' }}>
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: `${Colors.primary}22`, border: `1px solid ${Colors.primary}44`,
                borderRadius: '100px', padding: '6px 16px', marginBottom: '28px',
                fontSize: '13px', color: Colors.primary, fontWeight: 600,
              }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>verified</span>
              LOQIT — Next Gen Phone Recovery Protocol
            </motion.div>

            <h1 style={{
              fontSize: 'clamp(32px, 5vw, 68px)',
              fontWeight: 900, lineHeight: 1.08,
              marginBottom: '24px',
              background: `linear-gradient(135deg, ${Colors.onSurface} 0%, ${Colors.primary} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Your Device,<br />Always Protected
            </h1>

            <p style={{
              fontSize: '17px', color: Colors.onSurfaceVariant,
              lineHeight: 1.75, marginBottom: '40px',
              maxWidth: '500px',
            }}>
              Register your device, get instant BLE detection alerts when it's near a finder,
              and recover it through a secure, anonymous channel — trusted by citizens and law enforcement.
            </p>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/login')}
                style={{
                  background: `linear-gradient(135deg, ${Colors.primary}, ${Colors.accent})`,
                  color: Colors.onPrimary, border: 'none', borderRadius: '14px',
                  padding: '15px 34px', fontSize: '16px', fontWeight: 700,
                  cursor: 'pointer', boxShadow: `0 8px 30px ${Colors.primary}50`,
                }}
              >
                Get Started Free
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => scrollTo('how-it-works')}
                style={{
                  background: 'transparent', color: Colors.onSurface,
                  border: `1px solid ${Colors.outlineVariant}`, borderRadius: '14px',
                  padding: '15px 34px', fontSize: '16px', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                See How It Works
              </motion.button>
            </div>

            {/* Phone silhouette with BLE badge — kept below CTA as accent */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.9 }}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '44px' }}
            >
              <div style={{
                position: 'relative',
                width: '52px', height: '86px', flexShrink: 0,
              }}>
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  style={{
                    width: '100%', height: '100%',
                    background: `linear-gradient(160deg, ${Colors.surfaceContainerHigh} 0%, ${Colors.surfaceContainerHighest} 100%)`,
                    borderRadius: '12px',
                    border: `1.5px solid ${Colors.primary}66`,
                    boxShadow: `0 0 24px ${Colors.primary}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '22px', color: Colors.primary }}>smartphone</span>
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', top: '-8px', right: '-10px',
                    background: Colors.secondary, color: Colors.onSecondary,
                    borderRadius: '6px', padding: '2px 6px',
                    fontSize: '9px', fontWeight: 800,
                    boxShadow: `0 0 12px ${Colors.secondary}80`,
                  }}
                >
                  BLE
                </motion.div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: Colors.primary, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '2px' }}>Live Detection</div>
                <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>Scanning for lost devices nearby…</div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          animate={{ y: [0, 8, 0], opacity: [0.4, 0.8, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          style={{ position: 'absolute', bottom: '28px', left: '19%', transform: 'translateX(-50%)', zIndex: 2 }}
        >
          <span className="material-icons" style={{ fontSize: '28px', color: Colors.outline }}>expand_more</span>
        </motion.div>
      </section>

      {/* ── Live Stats ── */}
      <section style={{
        padding: '0 24px',
        position: 'relative',
        zIndex: 10,
        marginTop: '-40px'
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px'
        }}>
          <Counter target={stats.devices} label="Devices Registered" icon="devices" />
          <Counter target={stats.recovered} label="Devices Recovered" icon="check_circle" />
          <Counter target={stats.users} label="Active Users" icon="people" />
          <Counter target={stats.reports} label="Cases Filed" icon="assignment" />
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: '64px' }}
          >
            <div style={{
              display: 'inline-block', background: `${Colors.secondary}22`,
              border: `1px solid ${Colors.secondary}44`, borderRadius: '100px',
              padding: '6px 16px', marginBottom: '16px',
              fontSize: '13px', color: Colors.secondary, fontWeight: 600,
            }}>
              Platform Features
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px' }}>
              Everything You Need to Stay Protected
            </h2>
            <p style={{ fontSize: '17px', color: Colors.onSurfaceVariant, maxWidth: '560px', margin: '0 auto' }}>
              From BLE passive detection to AI-powered risk scoring — LOQIT covers every step of device recovery.
            </p>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <FeatureCard delay={0.0} icon="bluetooth" color={Colors.primary} title="BLE Passive Detection" desc="Background Bluetooth scanning instantly detects your lost device in proximity — even when the app is closed." />
            <FeatureCard delay={0.1} icon="notifications_active" color={Colors.secondary} title="Instant Push Alerts" desc="Push notifications fire the moment a beacon matching your device is detected nearby, anywhere in the network." />
            <FeatureCard delay={0.2} icon="chat_bubble" color={Colors.tertiary} title="Secure Anonymous Chat" desc="Communicate with the finder through end-to-end encrypted, anonymous messaging — no personal details exposed." />
            <FeatureCard delay={0.3} icon="psychology" color="#c084fc" title="AI Risk Scoring" desc="Groq-powered chat analysis automatically flags suspicious patterns, evasion, and extortion signals for police review." />
            <FeatureCard delay={0.4} icon="shield" color={Colors.accent} title="Serial Number Registration" desc="Register your device Serial Number for ownership proof. Duplicate registrations are flagged and reviewed by officers." />
            <FeatureCard delay={0.5} icon="local_police" color={Colors.error} title="Police Command Center" desc="Law enforcement gets a full dashboard — case assignment, analytics, recovery tracking, and real-time alerts." />
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" style={{ padding: '100px 24px', background: Colors.surfaceContainerLowest }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: '80px' }}
          >
            <div style={{
              display: 'inline-block', background: `${Colors.tertiary}22`,
              border: `1px solid ${Colors.tertiary}44`, borderRadius: '100px',
              padding: '6px 16px', marginBottom: '16px',
              fontSize: '13px', color: Colors.tertiary, fontWeight: 600,
            }}>
              Recovery Story
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px' }}>
              From Lost to Found in 5 Steps
            </h2>
            <p style={{ fontSize: '17px', color: Colors.onSurfaceVariant }}>
              See the complete recovery journey — from registration to reunion.
            </p>
          </motion.div>
          <StoryStep step="01" icon="app_registration" title="Register Your Device" desc="Add your phone's Serial Number, model, and details to LOQIT. Your ownership is verified and stored securely on Supabase." color={Colors.primary} delay={0} align="left" />
          <StoryStep step="02" icon="sentiment_very_dissatisfied" title="Device Goes Missing" desc="Mark your device as lost with one tap. It enters Lost Mode — broadcasting a silent BLE beacon that the LOQIT network watches for." color={Colors.error} delay={0.1} align="right" />
          <StoryStep step="03" icon="my_location" title="Finder Detects It Nearby" desc="Any LOQIT user nearby gets an automatic push notification. Their app silently records location and triggers a finder alert to you." color={Colors.secondary} delay={0.2} align="left" />
          <StoryStep step="04" icon="chat" title="Secure Chat Initiated" desc="A one-time anonymous chat room opens. No names, no numbers shared. AI risk scoring monitors the conversation for safety." color={Colors.tertiary} delay={0.3} align="right" />
          <StoryStep step="05" icon="celebration" title="Device Recovered" desc="Arrange a safe handover. Police officers can be looped in any time. The case closes and the device is marked recovered." color={Colors.secondary} delay={0.4} align="left" />
        </div>
      </section>

      {/* ── Interactive Demo Walkthrough ── */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: '60px' }}
          >
            <div style={{
              display: 'inline-block', background: `${Colors.accent}22`,
              border: `1px solid ${Colors.accent}44`, borderRadius: '100px',
              padding: '6px 16px', marginBottom: '16px',
              fontSize: '13px', color: Colors.accent, fontWeight: 600,
            }}>
              Try It Now
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px' }}>
              No Signup Required Demo
            </h2>
            <p style={{ fontSize: '17px', color: Colors.onSurfaceVariant, maxWidth: '540px', margin: '0 auto' }}>
              Click through the steps to see LOQIT in action — register a device, mark it lost, and watch the BLE network respond.
            </p>
          </motion.div>
          <DemoWalkthrough />
        </div>
      </section>

      {/* ── Download ── */}
      <section id="download" style={{
        padding: '100px 24px',
        background: `linear-gradient(135deg, ${Colors.surfaceContainerLow} 0%, ${Colors.surfaceContainerLowest} 100%)`,
        borderTop: `1px solid ${Colors.outlineVariant}`,
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="material-icons" style={{ fontSize: '56px', color: Colors.primary, marginBottom: '16px', display: 'block' }}>
              download
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px' }}>
              Get the LOQIT App
            </h2>
            <p style={{ fontSize: '17px', color: Colors.onSurfaceVariant, marginBottom: '48px', lineHeight: 1.7 }}>
              The full BLE detection and push notification experience requires the mobile app.
              The web dashboard is available on all devices for device management and monitoring.
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
              <DownloadBtn primary icon="android" label="Android APK" sub="Direct Download" href="#" />
              <DownloadBtn icon="phone_iphone" label="iOS (Coming Soon)" sub="App Store" href="#" />
              <DownloadBtn icon="web" label="Web Dashboard" sub="Open in Browser" href="/login" />
            </div>
            <p style={{ fontSize: '13px', color: Colors.outline }}>
              Android APK requires enabling "Install from unknown sources" in settings.
              iOS version pending App Store review.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${Colors.outlineVariant}`,
        padding: '40px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
          <span className="material-icons" style={{ color: Colors.primary }}>security</span>
          LOQIT
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <button onClick={() => navigate('/about')} style={{ background: 'none', border: 'none', color: Colors.onSurfaceVariant, cursor: 'pointer', fontSize: '14px' }}>About</button>
          <button onClick={() => navigate('/privacy-policy')} style={{ background: 'none', border: 'none', color: Colors.onSurfaceVariant, cursor: 'pointer', fontSize: '14px' }}>Privacy</button>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: Colors.primary, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Sign In</button>
        </div>
        <div style={{ fontSize: '13px', color: Colors.outline }}>
          © 2026 LOQIT. Secure Phone Ownership & Recovery System.
        </div>
      </footer>
    </div>
  )
}

/* ─── Interactive Demo Walkthrough ────────────────────────────── */
const DEMO_STEPS = [
  {
    id: 'register',
    icon: 'app_registration',
    title: 'Register a Device',
    color: Colors.primary,
    desc: 'Add your phone details and Serial Number to establish ownership.',
    mockup: (
      <div style={{ padding: '24px' }}>
        <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, marginBottom: '16px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}>Device Registration</div>
        {[
          { label: 'Brand', value: 'Samsung' },
          { label: 'Model', value: 'Galaxy S24' },
          { label: 'Serial Number', value: '358***4567890' },
          { label: 'Color', value: 'Phantom Black' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: Colors.outline, marginBottom: '4px' }}>{f.label}</div>
            <div style={{ background: Colors.surfaceContainerHigh, borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: Colors.onSurface, border: `1px solid ${Colors.outlineVariant}` }}>{f.value}</div>
          </div>
        ))}
        <div style={{ marginTop: '20px', background: Colors.primary, borderRadius: '10px', padding: '12px', textAlign: 'center', fontWeight: 700, color: Colors.onPrimary, fontSize: '14px' }}>Register Device</div>
      </div>
    ),
  },
  {
    id: 'lost',
    icon: 'report_problem',
    title: 'Mark as Lost',
    color: Colors.error,
    desc: 'One tap activates lost mode — the BLE beacon goes live instantly.',
    mockup: (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', borderRadius: '50%', background: `${Colors.error}22`, border: `2px solid ${Colors.error}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-icons" style={{ fontSize: '36px', color: Colors.error }}>report_problem</span>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Samsung Galaxy S24</div>
        <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, marginBottom: '24px' }}>SN: 358***890</div>
        <div style={{ background: `${Colors.error}22`, border: `1px solid ${Colors.error}44`, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ color: Colors.error, fontWeight: 700, marginBottom: '4px' }}>Activate Lost Mode</div>
          <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>BLE beacon will broadcast on the LOQIT network</div>
        </div>
        <motion.div animate={{ scale: [1, 1.04, 1], boxShadow: [`0 0 0 0 ${Colors.error}60`, `0 0 0 12px ${Colors.error}00`] }} transition={{ repeat: Infinity, duration: 2 }} style={{ background: Colors.error, borderRadius: '10px', padding: '12px', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Mark as Lost</motion.div>
      </div>
    ),
  },
  {
    id: 'detected',
    icon: 'my_location',
    title: 'BLE Detection',
    color: Colors.secondary,
    desc: 'A nearby LOQIT user\'s phone detects the beacon. You\'re notified instantly.',
    mockup: (
      <div style={{ padding: '24px' }}>
        <div style={{ background: `${Colors.secondary}22`, border: `1px solid ${Colors.secondary}44`, borderRadius: '14px', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <span className="material-icons" style={{ color: Colors.secondary, fontSize: '32px' }}>bluetooth_searching</span>
          </motion.div>
          <div>
            <div style={{ fontWeight: 700, color: Colors.secondary, marginBottom: '2px' }}>Lost Device Detected!</div>
            <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>Samsung Galaxy S24 · ~15m away</div>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, marginBottom: '12px' }}>Detection Details</div>
        {[{ k: 'Signal Strength', v: '-68 dBm (Strong)' }, { k: 'Distance', v: '~15 meters' }, { k: 'Last Seen', v: 'Just now' }].map(r => (
          <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span style={{ color: Colors.outline }}>{r.k}</span>
            <span style={{ color: Colors.onSurface, fontWeight: 600 }}>{r.v}</span>
          </div>
        ))}
        <div style={{ marginTop: '16px', background: Colors.secondary, borderRadius: '10px', padding: '12px', textAlign: 'center', color: Colors.onSecondary, fontWeight: 700, fontSize: '14px' }}>Notify Owner</div>
      </div>
    ),
  },
  {
    id: 'chat',
    icon: 'chat_bubble',
    title: 'Secure Chat',
    color: Colors.tertiary,
    desc: 'Anonymous encrypted chat between finder and owner. AI monitors for risk.',
    mockup: (
      <div style={{ padding: '16px 20px', height: '260px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        {[
          { role: 'system', text: 'Chat room opened. Both parties are anonymous.' },
          { role: 'finder', text: 'Hi, I found a phone that matches your description near MG Road.' },
          { role: 'owner', text: 'Yes! That\'s my phone. Can we arrange a handover?' },
          { role: 'finder', text: 'Sure. I\'m free tomorrow afternoon. Any public place works.' },
        ].map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'owner' ? 'flex-end' : m.role === 'system' ? 'center' : 'flex-start',
            maxWidth: '80%',
          }}>
            {m.role === 'system'
              ? <div style={{ fontSize: '11px', color: Colors.outline, textAlign: 'center', background: Colors.surfaceContainerHigh, padding: '4px 12px', borderRadius: '100px' }}>{m.text}</div>
              : <div style={{ background: m.role === 'owner' ? Colors.primaryContainer : Colors.surfaceContainerHigh, color: Colors.onSurface, borderRadius: '14px', padding: '10px 14px', fontSize: '13px' }}>{m.text}</div>
            }
          </div>
        ))}
        <div style={{ alignSelf: 'flex-end', background: `${Colors.secondary}22`, border: `1px solid ${Colors.secondary}44`, borderRadius: '10px', padding: '6px 12px', fontSize: '11px', color: Colors.secondary, fontWeight: 600 }}>
          AI Risk: Low ✓
        </div>
      </div>
    ),
  },
  {
    id: 'recovered',
    icon: 'celebration',
    title: 'Recovered!',
    color: Colors.secondary,
    desc: 'Device handed over safely. Case closed. LOQIT stats updated.',
    mockup: (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <motion.div animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 3 }}>
          <span className="material-icons" style={{ fontSize: '64px', color: Colors.secondary }}>celebration</span>
        </motion.div>
        <div style={{ fontSize: '22px', fontWeight: 800, margin: '16px 0 8px', color: Colors.secondary }}>Device Recovered!</div>
        <div style={{ fontSize: '14px', color: Colors.onSurfaceVariant, marginBottom: '24px' }}>Samsung Galaxy S24 safely returned to its owner.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[{ icon: 'schedule', text: '2h 14m', sub: 'Time to Recover' }, { icon: 'security', text: 'Secure', sub: 'Handover Method' }].map(s => (
            <div key={s.text} style={{ background: Colors.surfaceContainerHigh, borderRadius: '14px', padding: '16px 12px' }}>
              <span className="material-icons" style={{ fontSize: '24px', color: Colors.secondary, marginBottom: '6px', display: 'block' }}>{s.icon}</span>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>{s.text}</div>
              <div style={{ fontSize: '11px', color: Colors.outline }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

function DemoWalkthrough() {
  const [active, setActive] = useState(0)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 300px) 1fr', gap: '24px', alignItems: 'start' }}>
      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {DEMO_STEPS.map((step, i) => (
          <button
            key={step.id}
            onClick={() => setActive(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 16px', borderRadius: '14px',
              background: active === i ? `${step.color}22` : Colors.surfaceContainerLow,
              border: `1px solid ${active === i ? step.color + '66' : Colors.outlineVariant}`,
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
          >
            <span className="material-icons" style={{ fontSize: '22px', color: active === i ? step.color : Colors.outline }}>{step.icon}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: active === i ? Colors.onSurface : Colors.onSurfaceVariant }}>{step.title}</div>
              <div style={{ fontSize: '11px', color: Colors.outline, marginTop: '2px' }}>{step.desc.slice(0, 40)}…</div>
            </div>
          </button>
        ))}
      </div>
      {/* Mockup */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, x: 30, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -20, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: Colors.surfaceContainerLow,
            border: `1px solid ${DEMO_STEPS[active].color}44`,
            borderRadius: '20px',
            minHeight: '300px',
            overflow: 'hidden',
          }}
        >
          <div style={{
            background: `${DEMO_STEPS[active].color}18`,
            borderBottom: `1px solid ${DEMO_STEPS[active].color}33`,
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span className="material-icons" style={{ fontSize: '20px', color: DEMO_STEPS[active].color }}>{DEMO_STEPS[active].icon}</span>
            <span style={{ fontWeight: 700, color: Colors.onSurface, fontSize: '15px' }}>{DEMO_STEPS[active].title}</span>
          </div>
          {DEMO_STEPS[active].mockup}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
