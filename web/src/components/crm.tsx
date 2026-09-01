/**
 * Shared UI kit in the DataCircles CRM's visual language.
 *
 * Every LOQIT page builds from these primitives so the app reads as one
 * product: white cards on a light ground, 20px radii, #F2F2F7 hairline
 * borders, a muted grey label above a near-black value, and #2776EA for
 * actions. Tokens come from the --crm-* CSS variables in styles/global.ts,
 * which carry dark-mode equivalents so the theme toggle keeps working.
 */
import { CSSProperties, ReactNode, useState } from 'react'
import { LucideIcon, MoreVertical, RefreshCw, WifiOff, ChevronRight } from 'lucide-react'

export const C = {
  page: 'var(--crm-page)',
  card: 'var(--crm-card)',
  border: 'var(--crm-border)',
  tile: 'var(--crm-tile)',
  tileBorder: 'var(--crm-tile-border)',
  heading: 'var(--crm-heading)',
  label: 'var(--crm-label)',
  muted: 'var(--crm-muted)',
  primary: 'var(--crm-primary)',
  primaryHover: 'var(--crm-primary-hover)',
  shadow: 'var(--crm-shadow)',
  chrome: 'var(--crm-chrome)',
}

/** Semantic accents, matched to the CRM's status colours. */
export const TONE = {
  blue: '#2776EA',
  green: '#059669',
  amber: '#D97706',
  red: '#DC2626',
  grey: '#6B7280',
} as const

export const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"

export const cardStyle: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: '20px',
  boxShadow: C.shadow,
}

/** Injected once per page; keeps hover/animation rules out of inline styles. */
export function CrmStyles() {
  return (
    <style>{`
      @keyframes crmPulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
      .crm-row { transition: background .15s ease }
      .crm-row:hover { background: var(--crm-tile) }
      .crm-hoverable { transition: border-color .15s ease, background .15s ease }
      .crm-hoverable:hover { border-color: var(--crm-primary) !important; background: var(--crm-tile) }
      .crm-input:focus { outline: none; border-color: var(--crm-primary) !important;
                         box-shadow: 0 0 0 3px rgba(39,118,234,.12) }
      @media (max-width: 1100px) {
        .crm-c4 { grid-template-columns: repeat(2, 1fr) !important }
        .crm-c3 { grid-template-columns: repeat(2, 1fr) !important }
        .crm-split { grid-template-columns: 1fr !important }
      }
      @media (max-width: 640px) {
        .crm-c4, .crm-c3, .crm-c2 { grid-template-columns: 1fr !important }
      }
    `}</style>
  )
}

/** Page shell: light ground, full width, consistent gutters. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: C.page, minHeight: '100%', fontFamily: FONT }}>
      <CrmStyles />
      <div style={{ padding: '24px 28px', maxWidth: '1920px', margin: '0 auto' }}>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: ReactNode
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: '16px', marginBottom: '20px', flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: C.heading, margin: '0 0 4px' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: '14px', color: C.muted, fontWeight: 500, margin: 0 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}

export function Card({ children, style, padding = 0, onClick }: {
  children: ReactNode; style?: CSSProperties; padding?: number | string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        ...cardStyle,
        padding: typeof padding === 'number' ? `${padding}px` : padding,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: ReactNode
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: '12px', padding: '20px 24px 16px',
    }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.heading, margin: '0 0 2px' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '13px', color: C.muted, fontWeight: 500, margin: 0 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({ children, onClick, icon: Icon, variant = 'primary', tone, disabled, type = 'button', full }: {
  children?: ReactNode
  onClick?: () => void
  icon?: LucideIcon
  variant?: 'primary' | 'ghost' | 'danger'
  tone?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  full?: boolean
}) {
  const [hover, setHover] = useState(false)
  const accent = tone || (variant === 'danger' ? TONE.red : C.primary)
  const solid = variant === 'primary' || variant === 'danger'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: full ? 'flex' : 'inline-flex',
        width: full ? '100%' : undefined,
        alignItems: 'center', justifyContent: 'center', gap: '6px',
        padding: '9px 14px', borderRadius: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '13px', fontWeight: 600, fontFamily: FONT,
        background: solid
          ? (disabled ? C.muted : hover ? (variant === 'danger' ? '#B91C1C' : C.primaryHover) : accent)
          : hover ? C.tile : C.card,
        color: solid ? '#fff' : disabled ? C.muted : C.heading,
        border: `1px solid ${solid ? 'transparent' : C.border}`,
        boxShadow: C.shadow,
        opacity: disabled ? 0.65 : 1,
        transition: 'background .15s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={15} strokeWidth={2} />}
      {children}
    </button>
  )
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: {
  width?: number | string; height?: number | string; radius?: number; style?: CSSProperties
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: `${radius}px`,
        background: C.tileBorder,
        animation: 'crmPulse 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/** Big KPI card: muted label, 24px value, small trailing note. */
export function SummaryCard({ label, value, note, icon: Icon, tone = TONE.blue, loading, onClick }: {
  label: string; value: ReactNode; note?: string; icon: LucideIcon
  tone?: string; loading?: boolean; onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...cardStyle, padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .18s ease',
        boxShadow: hover && onClick ? '0 4px 16px rgba(17,18,22,0.06)' : C.shadow,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Icon size={16} strokeWidth={1.75} color={tone} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '13px', color: C.label, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        </div>
        <MoreVertical size={16} color={C.muted} style={{ flexShrink: 0, opacity: 0.5 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px' }}>
        {loading
          ? <Skeleton width={56} height={28} />
          : <h3 style={{ fontSize: '24px', fontWeight: 700, color: C.heading, margin: 0, lineHeight: 1.1 }}>{value}</h3>}
        {note && !loading && <p style={{ fontSize: '11px', color: C.muted, fontWeight: 500, margin: 0, whiteSpace: 'nowrap' }}>{note}</p>}
      </div>
    </div>
  )
}

/** The CRM's compact 56px stat tile. */
export function StatTile({ label, value, icon: Icon, tone = TONE.blue, loading }: {
  label: string; value: ReactNode; icon: LucideIcon; tone?: string; loading?: boolean
}) {
  return (
    <div style={{
      height: '56px', display: 'flex', alignItems: 'center', gap: '8px',
      padding: '0 12px', background: C.tile,
      border: `1px solid ${C.tileBorder}`, borderRadius: '12px', minWidth: 0,
    }}>
      <Icon size={20} strokeWidth={1.5} color={tone} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: '11px', color: C.label, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        {loading
          ? <Skeleton width={64} height={14} style={{ marginTop: '4px' }} />
          : <p style={{ fontSize: '14px', fontWeight: 600, color: C.heading, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = TONE.grey }: { children: ReactNode; tone?: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
      background: `${tone}14`, color: tone, border: `1px solid ${tone}33`,
    }}>
      {children}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: {
  icon: LucideIcon; title: string; body?: string; action?: ReactNode
}) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '14px', margin: '0 auto 12px',
        background: C.tile, border: `1px solid ${C.tileBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} color={C.muted} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: C.heading, marginBottom: '4px' }}>{title}</div>
      {body && <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 16px', maxWidth: '380px', marginInline: 'auto' }}>{body}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <WifiOff size={28} color={C.muted} />
      <div style={{ fontSize: '14px', fontWeight: 600, color: C.heading, margin: '12px 0 4px' }}>
        Couldn't load this page
      </div>
      <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 16px' }}>
        {message || "The server didn't respond. Your data is safe."}
      </p>
      {onRetry && <Button variant="ghost" onClick={onRetry} icon={RefreshCw}>Try again</Button>}
    </div>
  )
}

/** Inline banner — used for connection failures and warnings. */
export function Banner({ tone, icon: Icon, title, body, action }: {
  tone: 'red' | 'amber' | 'blue'; icon: LucideIcon; title: string; body?: string; action?: ReactNode
}) {
  const palette = {
    red: { bg: '#FEF2F2', border: '#FECACA', head: '#991B1B', text: '#B91C1C', icon: TONE.red },
    amber: { bg: '#FFFBEB', border: '#FDE68A', head: '#92400E', text: '#B45309', icon: TONE.amber },
    blue: { bg: '#EFF6FF', border: '#BFDBFE', head: '#1E40AF', text: '#1D4ED8', icon: TONE.blue },
  }[tone]

  return (
    <div style={{
      ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 18px', marginBottom: '20px',
      background: palette.bg, borderColor: palette.border,
    }}>
      <Icon size={18} color={palette.icon} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: palette.head }}>{title}</div>
        {body && <div style={{ fontSize: '12px', color: palette.text, marginTop: '1px' }}>{body}</div>}
      </div>
      {action}
    </div>
  )
}

// ── table ───────────────────────────────────────────────────────────────────

export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr>
        {columns.map(col => (
          <th key={col} style={{
            padding: '10px 24px', textAlign: 'left', fontSize: '11px',
            fontWeight: 600, color: C.label, whiteSpace: 'nowrap',
            borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
            background: C.tile,
          }}>{col}</th>
        ))}
      </tr>
    </thead>
  )
}

export const td: CSSProperties = { padding: '12px 24px', fontSize: '13px', color: C.heading }
export const tdMuted: CSSProperties = { ...td, fontSize: '12px', color: C.label }
export const tdMono: CSSProperties = { ...tdMuted, fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }

/** Small icon in a bordered square — the CRM's list-row avatar. */
export function IconTile({ icon: Icon, tone = C.primary, size = 34 }: {
  icon: LucideIcon; tone?: string; size?: number
}) {
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '10px', flexShrink: 0,
      background: C.tile, border: `1px solid ${C.tileBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={Math.round(size / 2)} color={tone} strokeWidth={1.75} />
    </div>
  )
}

// ── forms ───────────────────────────────────────────────────────────────────

export const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  fontSize: '13px', fontFamily: FONT,
  background: C.card, color: C.heading,
  border: `1px solid ${C.tileBorder}`,
  boxSizing: 'border-box', transition: 'border-color .15s ease, box-shadow .15s ease',
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.label, marginBottom: '6px' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: '11px', color: C.muted, margin: '5px 0 0' }}>{hint}</p>}
    </div>
  )
}

/** A tappable list row with a trailing chevron. */
export function ActionRow({ icon: Icon, label, description, onClick, tone = C.primary, trailing }: {
  icon: LucideIcon; label: string; description?: string; onClick?: () => void
  tone?: string; trailing?: ReactNode
}) {
  return (
    <button
      className="crm-hoverable"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '11px 12px', borderRadius: '12px', width: '100%',
        background: C.card, border: `1px solid ${C.border}`,
        cursor: onClick ? 'pointer' : 'default', textAlign: 'left',
        color: C.heading, fontFamily: FONT,
      }}
    >
      <Icon size={17} strokeWidth={1.75} color={tone} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: 500 }}>{label}</span>
        {description && <span style={{ display: 'block', fontSize: '11px', color: C.muted, marginTop: '1px' }}>{description}</span>}
      </span>
      {trailing ?? <ChevronRight size={15} color={C.muted} />}
    </button>
  )
}
