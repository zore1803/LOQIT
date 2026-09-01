import { useState } from 'react'
import {
  Search, SearchX, Smartphone, FileText, User, AlertCircle, Loader2,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { db } from '../../lib/db'
import {
  C, TONE, FONT, Page, PageHeader, Card, Button, Badge,
  Skeleton, EmptyState, IconTile, inputStyle,
} from '../../components/crm'

type SearchResult = {
  type: 'device' | 'report' | 'user'
  id: string
  title: string
  subtitle: string
  details: string[]
  data: any
}

const TYPES = [
  { key: 'all', label: 'Everything' },
  { key: 'serial', label: 'Devices' },
  { key: 'complaint', label: 'Reports' },
  { key: 'phone', label: 'People' },
] as const

const RESULT_META: Record<SearchResult['type'], { icon: LucideIcon; tone: string; label: string }> = {
  device: { icon: Smartphone, tone: TONE.blue, label: 'Device' },
  report: { icon: FileText, tone: TONE.amber, label: 'Report' },
  user: { icon: User, tone: TONE.green, label: 'Person' },
}

export function PoliceSearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'all' | 'serial' | 'complaint' | 'phone'>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const performSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setSearched(true)
    setError('')
    const found: SearchResult[] = []

    try {
      if (searchType === 'all' || searchType === 'serial') {
        const { data: devices } = await db
          .from('devices')
          .select('*, profiles(full_name, phone_number)')
          .or(`serial_number.ilike.%${searchQuery}%,make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%,ble_device_uuid.ilike.%${searchQuery}%`)
          .limit(20)

        devices?.forEach((device: any) => {
          found.push({
            type: 'device',
            id: device.id,
            title: `${device.make} ${device.model}`,
            subtitle: String(device.status || '').toUpperCase(),
            details: [
              `Serial: ${device.serial_number}`,
              `HW ID: ${device.ble_device_uuid || 'GENERIC'}`,
              `Owner: ${device.profiles?.full_name || 'Unknown'}`,
            ],
            data: device,
          })
        })
      }

      if (searchType === 'all' || searchType === 'complaint') {
        const { data: reports } = await db
          .from('lost_reports')
          .select('*, devices(make, model, serial_number), profiles(full_name, phone_number)')
          .or(`police_complaint_number.ilike.%${searchQuery}%,incident_description.ilike.%${searchQuery}%`)
          .limit(20)

        reports?.forEach((report: any) => {
          found.push({
            type: 'report',
            id: report.id,
            title: report.police_complaint_number || 'No FIR number',
            subtitle: `${report.devices?.make ?? ''} ${report.devices?.model ?? ''}`.trim() || 'Unknown device',
            details: [
              `Owner: ${report.profiles?.full_name || 'Unknown'}`,
              `Status: ${report.is_active ? 'Active' : 'Resolved'}`,
              `Reported: ${new Date(report.reported_at).toLocaleDateString('en-IN')}`,
            ],
            data: report,
          })
        })
      }

      if (searchType === 'all' || searchType === 'phone') {
        const { data: users } = await db
          .from('profiles')
          .select('*')
          .or(`full_name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`)
          .eq('role', 'civilian')
          .limit(20)

        users?.forEach((user: any) => {
          found.push({
            type: 'user',
            id: user.id,
            title: user.full_name || 'Unnamed user',
            subtitle: user.phone_number || 'No phone number',
            details: [
              `Aadhaar: ${user.aadhaar_verified ? 'Verified' : 'Not verified'}`,
              `Joined: ${new Date(user.created_at).toLocaleDateString('en-IN')}`,
            ],
            data: user,
          })
        })
      }

      setResults(found)
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const counts = {
    device: results.filter(r => r.type === 'device').length,
    report: results.filter(r => r.type === 'report').length,
    user: results.filter(r => r.type === 'user').length,
  }

  return (
    <Page>
      <PageHeader
        title="Search"
        subtitle="Look up a device, case file or registered owner"
      />

      {/* Search bar */}
      <Card style={{ padding: '18px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 0 }}>
            <Search size={15} color={C.muted} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="crm-input"
              placeholder="Serial number, FIR number, name or phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') performSearch() }}
              style={{ ...inputStyle, paddingLeft: '34px' }}
            />
          </div>
          <Button icon={loading ? Loader2 : Search} onClick={performSearch} disabled={loading || !searchQuery.trim()}>
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: C.label }}>Look in</span>
          <div style={{ display: 'flex', gap: '4px', background: C.tile, border: `1px solid ${C.tileBorder}`, borderRadius: '999px', padding: '3px' }}>
            {TYPES.map(t => {
              const active = searchType === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setSearchType(t.key)}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                    background: active ? C.card : 'transparent',
                    color: active ? C.primary : C.label,
                    border: `1px solid ${active ? C.tileBorder : 'transparent'}`,
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {error && (
        <Card style={{ padding: '13px 18px', marginBottom: '20px', background: '#FEF2F2', borderColor: '#FECACA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <AlertCircle size={16} color={TONE.red} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#991B1B', fontWeight: 500 }}>{error}</span>
          </div>
        </Card>
      )}

      {/* Result counts */}
      {searched && !loading && results.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {(Object.keys(counts) as Array<keyof typeof counts>).filter(k => counts[k] > 0).map(k => {
            const m = RESULT_META[k]
            return (
              <span key={k} style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '7px 13px', borderRadius: '999px',
                background: C.card, border: `1px solid ${C.border}`,
                fontSize: '12px', fontWeight: 500, color: C.label,
              }}>
                <m.icon size={14} color={m.tone} />
                {counts[k]} {m.label.toLowerCase()}{counts[k] === 1 ? '' : 's'}
              </span>
            )
          })}
        </div>
      )}

      <Card>
        {loading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', gap: '12px' }}>
                <Skeleton width={38} height={38} radius={10} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="35%" height={13} />
                  <Skeleton width="55%" height={11} style={{ marginTop: '6px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : !searched ? (
          <EmptyState
            icon={Search}
            title="Search the LOQIT network"
            body="Enter a serial number, FIR number, owner name or phone number. Every lookup is recorded in the access log."
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            body={`Nothing found for "${searchQuery}". Try a different term, or widen the search to everything.`}
            action={searchType !== 'all'
              ? <Button variant="ghost" onClick={() => { setSearchType('all'); performSearch() }}>Search everything</Button>
              : undefined}
          />
        ) : (
          <div>
            {results.map((result, i) => {
              const m = RESULT_META[result.type]
              return (
                <div
                  key={`${result.type}-${result.id}`}
                  className="crm-row"
                  style={{
                    display: 'flex', gap: '12px', padding: '14px 20px',
                    borderBottom: i < results.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <IconTile icon={m.icon} tone={m.tone} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: C.heading }}>{result.title}</span>
                      <Badge tone={m.tone}>{m.label}</Badge>
                    </div>
                    <div style={{ fontSize: '12px', color: C.label, marginTop: '2px' }}>{result.subtitle}</div>
                    <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {result.details.map(d => (
                        <span key={d} style={{ fontSize: '11.5px', color: C.muted }}>{d}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </Page>
  )
}
