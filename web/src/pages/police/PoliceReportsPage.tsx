import { useEffect, useState } from 'react'
import {
  Inbox, FileSearch, CheckCircle2, Lock,
  AlertTriangle, X, UserPlus, User, Save, FileDown, RefreshCw,
} from 'lucide-react'
import { db } from '../../lib/db'
import { generateCaseSummary } from '../../services/aiService'
import {
  C, TONE, FONT, Page, PageHeader, Card, Button,
  Skeleton, EmptyState, inputStyle,
} from '../../components/crm'

type CaseStatus = 'unassigned' | 'under_investigation' | 'resolved' | 'closed'

type LostReport = {
  id: string
  device_id: string
  owner_id: string
  last_known_lat: number | null
  last_known_lng: number | null
  last_known_address: string | null
  incident_description: string | null
  police_complaint_number: string | null
  reward_amount: number | null
  is_active: boolean
  reported_at: string
  resolved_at: string | null
  case_status: CaseStatus | null
  assigned_officer_id: string | null
  assigned_at: string | null
  case_notes: string | null
  devices: Array<{ make: string; model: string; serial_number: string; status: string }> | null
  profiles: Array<{ full_name: string; phone_number: string | null }> | null
}

type OfficerProfile = { id: string; full_name: string | null }

const STATUS_CONFIG: Record<CaseStatus, { label: string; tone: string; icon: typeof Inbox }> = {
  unassigned: { label: 'Unassigned', tone: TONE.grey, icon: Inbox },
  under_investigation: { label: 'Under Investigation', tone: TONE.amber, icon: FileSearch },
  resolved: { label: 'Resolved', tone: TONE.green, icon: CheckCircle2 },
  closed: { label: 'Closed', tone: TONE.blue, icon: Lock },
}

function StatusBadge({ status }: { status: CaseStatus | null }) {
  const cfg = STATUS_CONFIG[status || 'unassigned']
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      background: cfg.tone + '14', border: '1px solid ' + cfg.tone + '33',
      fontSize: '11px', fontWeight: 600, color: cfg.tone, whiteSpace: 'nowrap',
    }}>
      <Icon size={12} />
      {cfg.label}
    </span>
  )
}

export function PoliceReportsPage() {
  const [reports, setReports] = useState<LostReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active')
  const [selectedReport, setSelectedReport] = useState<LostReport | null>(null)
  const [officers, setOfficers] = useState<OfficerProfile[]>([])
  const [assigningOfficer, setAssigningOfficer] = useState(false)
  const [selectedOfficerId, setSelectedOfficerId] = useState('')
  const [caseNotes, setCaseNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  useEffect(() => { loadReports() }, [filter])
  useEffect(() => { loadOfficers() }, [])

  const loadOfficers = async () => {
    const { data } = await db
      .from('profiles')
      .select('id, full_name')
      .in('role', ['police', 'admin'])
    setOfficers((data as OfficerProfile[]) || [])
  }

  const loadReports = async () => {
    setLoading(true)
    try {
      let query = db
        .from('lost_reports')
        .select(`
          id, device_id, owner_id, last_known_lat, last_known_lng, last_known_address,
          incident_description, police_complaint_number, reward_amount, is_active,
          reported_at, resolved_at, case_status, assigned_officer_id, assigned_at, case_notes,
          devices(make, model, serial_number, status),
          profiles(full_name, phone_number)
        `)
        .order('reported_at', { ascending: false })
      if (filter === 'active') query = query.eq('is_active', true)
      else if (filter === 'resolved') query = query.eq('is_active', false)
      const { data, error } = await query
      if (error) throw error
      setReports(data as LostReport[])
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally { setLoading(false) }
  }

  const assignOfficer = async () => {
    if (!selectedReport || !selectedOfficerId) return
    setAssigningOfficer(true)
    try {
      const { error } = await db
        .from('lost_reports')
        .update({ assigned_officer_id: selectedOfficerId, assigned_at: new Date().toISOString(), case_status: 'under_investigation' })
        .eq('id', selectedReport.id)
      if (error) throw error
      await loadReports()
      setSelectedReport(prev => prev ? { ...prev, assigned_officer_id: selectedOfficerId, case_status: 'under_investigation' } : prev)
    } catch (err) { console.error('Error assigning officer:', err) }
    finally { setAssigningOfficer(false) }
  }

  const updateCaseStatus = async (status: CaseStatus) => {
    if (!selectedReport) return
    try {
      const updates: Record<string, unknown> = { case_status: status }
      if (status === 'resolved' || status === 'closed') {
        updates.is_active = false
        updates.resolved_at = new Date().toISOString()
      }
      const { error } = await db.from('lost_reports').update(updates).eq('id', selectedReport.id)
      if (error) throw error
      await loadReports()
      setSelectedReport(prev => prev ? { ...prev, case_status: status } : prev)
    } catch (err) { console.error('Error updating status:', err) }
  }

  const saveCaseNotes = async () => {
    if (!selectedReport) return
    setSavingNotes(true)
    try {
      const { error } = await db.from('lost_reports').update({ case_notes: caseNotes }).eq('id', selectedReport.id)
      if (error) throw error
      setSelectedReport(prev => prev ? { ...prev, case_notes: caseNotes } : prev)
    } catch (err) { console.error('Error saving notes:', err) }
    finally { setSavingNotes(false) }
  }

  const handleSelectReport = (r: LostReport) => {
    setSelectedReport(r)
    setSelectedOfficerId(r.assigned_officer_id || '')
    setCaseNotes(r.case_notes || '')
  }

  const exportEvidencePDF = async () => {
    if (!selectedReport) return
    setExportingPDF(true)
    try {
      const details = `
Case ID: ${selectedReport.id}
Device: ${selectedReport.devices?.[0]?.make} ${selectedReport.devices?.[0]?.model}
Serial: ${selectedReport.devices?.[0]?.serial_number}
Owner: ${selectedReport.profiles?.[0]?.full_name}
Phone: ${selectedReport.profiles?.[0]?.phone_number || 'N/A'}
Status: ${selectedReport.case_status || 'unassigned'}
Reported: ${new Date(selectedReport.reported_at).toLocaleString()}
${selectedReport.resolved_at ? `Resolved: ${new Date(selectedReport.resolved_at).toLocaleString()}` : ''}
Last Known Location: ${selectedReport.last_known_address || 'Unknown'}
Incident Description: ${selectedReport.incident_description || 'None'}
Police Complaint #: ${selectedReport.police_complaint_number || 'None'}
Reward Amount: ${selectedReport.reward_amount ? '₹' + selectedReport.reward_amount.toLocaleString() : 'None'}
Case Notes: ${selectedReport.case_notes || 'None'}
      `.trim()

      let summary = 'AI summary unavailable.'
      try { summary = await generateCaseSummary(details) } catch { /* ignore */ }

      const officerName = assignedOfficerName(selectedReport)
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LOQIT Case Report — ${selectedReport.id.slice(0, 8).toUpperCase()}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .logo-text { font-size: 24px; font-weight: 900; color: #1a1a2e; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: #555; margin-bottom: 32px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 12px; font-weight: 700; background: #e8f0fe; color: #1a73e8; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .field { background: #f9f9f9; border-radius: 8px; padding: 12px; }
    .field-label { font-size: 11px; text-transform: uppercase; color: #888; font-weight: 600; margin-bottom: 4px; }
    .field-value { font-size: 14px; color: #111; font-weight: 500; }
    .summary { background: #f0f7ff; border-left: 3px solid #1a73e8; padding: 16px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #888; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="logo">
    <div style="width:40px;height:40px;border-radius:10px;background:#1a73e8;display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:22px;">🔐</span>
    </div>
    <div>
      <div class="logo-text">LOQIT</div>
    </div>
  </div>
  <div class="subtitle">Secure Phone Ownership & Recovery System — Official Case Report</div>

  <h1>Case #${selectedReport.id.slice(0, 8).toUpperCase()}</h1>
  <span class="badge">${selectedReport.case_status?.replace('_', ' ').toUpperCase() || 'UNASSIGNED'}</span>

  <h2>Device Information</h2>
  <div class="grid">
    <div class="field"><div class="field-label">Device</div><div class="field-value">${selectedReport.devices?.[0]?.make} ${selectedReport.devices?.[0]?.model}</div></div>
    <div class="field"><div class="field-label">Serial Number</div><div class="field-value">${selectedReport.devices?.[0]?.serial_number}</div></div>
  </div>

  <h2>Owner Details</h2>
  <div class="grid">
    <div class="field"><div class="field-label">Name</div><div class="field-value">${selectedReport.profiles?.[0]?.full_name}</div></div>
    <div class="field"><div class="field-label">Phone</div><div class="field-value">${selectedReport.profiles?.[0]?.phone_number || 'N/A'}</div></div>
  </div>

  <h2>Case Details</h2>
  <div class="grid">
    <div class="field"><div class="field-label">Reported</div><div class="field-value">${new Date(selectedReport.reported_at).toLocaleString()}</div></div>
    <div class="field"><div class="field-label">Assigned Officer</div><div class="field-value">${officerName}</div></div>
    <div class="field"><div class="field-label">Location</div><div class="field-value">${selectedReport.last_known_address || 'Unknown'}</div></div>
    <div class="field"><div class="field-label">Complaint #</div><div class="field-value">${selectedReport.police_complaint_number || 'N/A'}</div></div>
  </div>

  ${selectedReport.incident_description ? `<h2>Incident Description</h2><div class="summary">${selectedReport.incident_description}</div>` : ''}
  ${selectedReport.case_notes ? `<h2>Investigation Notes</h2><div class="summary">${selectedReport.case_notes}</div>` : ''}

  <h2>AI Case Summary</h2>
  <div class="summary">${summary}</div>

  <div class="footer">
    Generated by LOQIT on ${new Date().toLocaleString()} — CONFIDENTIAL — For Law Enforcement Use Only
  </div>
</body>
</html>`

      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        setTimeout(() => win.print(), 500)
      }
    } finally { setExportingPDF(false) }
  }

  const assignedOfficerName = (r: LostReport) =>
    officers.find(o => o.id === r.assigned_officer_id)?.full_name || 'Unknown Officer'

  const unassignedCount = reports.filter(r => !r.case_status || r.case_status === 'unassigned').length

  return (
    <Page>
      <PageHeader
        title="Case Management"
        subtitle="Assign officers, track investigation status and manage case notes"
      />

      {unassignedCount > 0 && (
        <Card style={{ padding: '13px 18px', marginBottom: '20px', background: '#FEF2F2', borderColor: '#FECACA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <AlertTriangle size={16} color={TONE.red} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#991B1B', fontWeight: 600 }}>
              {unassignedCount} unassigned case{unassignedCount !== 1 ? 's' : ''} need attention
            </span>
          </div>
        </Card>
      )}

      <Card style={{ padding: '10px', marginBottom: '20px', display: 'inline-block' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['active', 'resolved', 'all'] as const).map(f => {
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '7px 16px', borderRadius: '999px', cursor: 'pointer',
                  fontSize: '12.5px', fontWeight: 600, fontFamily: FONT, textTransform: 'capitalize',
                  background: active ? C.primary : 'transparent',
                  color: active ? '#fff' : C.label,
                  border: '1px solid transparent',
                }}
              >
                {f}
              </button>
            )
          })}
        </div>
      </Card>

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: selectedReport ? 'minmax(0,1fr) 420px' : '1fr', gap: '20px', alignItems: 'start' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            [0, 1, 2].map(i => (
              <Card key={i} style={{ padding: '18px' }}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="60%" height={12} style={{ marginTop: '8px' }} />
                <Skeleton width={110} height={20} radius={999} style={{ marginTop: '10px' }} />
              </Card>
            ))
          ) : reports.length === 0 ? (
            <Card><EmptyState icon={Inbox} title="No reports found" body="Cases matching this filter will show up here." /></Card>
          ) : reports.map(r => {
            const active = selectedReport?.id === r.id
            return (
              <Card
                key={r.id}
                onClick={() => handleSelectReport(r)}
                style={{
                  padding: '18px 20px', cursor: 'pointer',
                  borderColor: active ? C.primary : undefined,
                  background: active ? 'rgba(39,118,234,.04)' : undefined,
                  transition: 'border-color .15s ease, background .15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: C.heading, marginBottom: '3px' }}>
                      {r.devices?.[0]?.make} {r.devices?.[0]?.model}
                    </div>
                    <div style={{ fontSize: '12px', color: C.muted, marginBottom: '10px' }}>
                      Serial {r.devices?.[0]?.serial_number} · {r.profiles?.[0]?.full_name}
                    </div>
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <StatusBadge status={r.case_status || 'unassigned'} />
                      {r.assigned_officer_id && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500,
                          color: C.label, background: C.tile, border: '1px solid ' + C.tileBorder,
                          borderRadius: '999px', padding: '3px 10px',
                        }}>
                          <User size={11} />
                          {assignedOfficerName(r)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '11.5px', color: C.muted }}>
                      {new Date(r.reported_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                    {r.reward_amount != null && (
                      <div style={{ fontSize: '13px', color: TONE.green, fontWeight: 700, marginTop: '4px' }}>
                        ₹{r.reward_amount.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {selectedReport && (
          <Card style={{ position: 'sticky', top: '20px', overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid ' + C.border,
            }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: C.heading, margin: 0 }}>Case Detail</h2>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Button variant="ghost" icon={exportingPDF ? RefreshCw : FileDown} onClick={exportEvidencePDF} disabled={exportingPDF}>
                  {exportingPDF ? 'Generating…' : 'Export PDF'}
                </Button>
                <button
                  onClick={() => setSelectedReport(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px', lineHeight: 0 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '76vh', overflowY: 'auto' }}>
              <div>
                <SectionLabel>Device</SectionLabel>
                <div style={{ fontSize: '16px', fontWeight: 700, color: C.heading }}>
                  {selectedReport.devices?.[0]?.make} {selectedReport.devices?.[0]?.model}
                </div>
                <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                  Serial {selectedReport.devices?.[0]?.serial_number}
                </div>
              </div>

              <div>
                <SectionLabel>Case status</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {(Object.keys(STATUS_CONFIG) as CaseStatus[]).map(s => {
                    const cfg = STATUS_CONFIG[s]
                    const active = selectedReport.case_status === s
                    return (
                      <button
                        key={s}
                        onClick={() => updateCaseStatus(s)}
                        style={{
                          padding: '7px 13px', borderRadius: '999px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 600, fontFamily: FONT,
                          background: active ? cfg.tone + '14' : C.tile,
                          color: active ? cfg.tone : C.label,
                          border: '1px solid ' + (active ? cfg.tone + '44' : C.tileBorder),
                        }}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <SectionLabel>Assign officer</SectionLabel>
                <select
                  className="crm-input"
                  value={selectedOfficerId}
                  onChange={e => setSelectedOfficerId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', marginBottom: '10px' }}
                >
                  <option value="">— Unassigned —</option>
                  {officers.map(o => <option key={o.id} value={o.id}>{o.full_name || 'Officer'}</option>)}
                </select>
                <Button full icon={UserPlus} onClick={assignOfficer} disabled={assigningOfficer || !selectedOfficerId}>
                  {assigningOfficer ? 'Assigning…' : selectedReport.assigned_officer_id ? 'Reassign Officer' : 'Assign Officer'}
                </Button>
                {selectedReport.assigned_officer_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: TONE.green, marginTop: '8px', fontWeight: 500 }}>
                    <CheckCircle2 size={14} />
                    Assigned to {assignedOfficerName(selectedReport)}
                  </div>
                )}
              </div>

              <div style={{ height: '1px', background: C.border }} />

              <div>
                <SectionLabel>Owner</SectionLabel>
                <div style={{ fontSize: '14px', fontWeight: 600, color: C.heading }}>{selectedReport.profiles?.[0]?.full_name}</div>
                {selectedReport.profiles?.[0]?.phone_number && (
                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '3px' }}>{selectedReport.profiles[0].phone_number}</div>
                )}
              </div>

              {selectedReport.incident_description && (
                <div>
                  <SectionLabel>Incident</SectionLabel>
                  <div style={{
                    fontSize: '13px', color: C.heading, lineHeight: 1.6,
                    background: C.tile, border: '1px solid ' + C.tileBorder,
                    borderRadius: '12px', padding: '12px 14px',
                  }}>
                    {selectedReport.incident_description}
                  </div>
                </div>
              )}

              <div>
                <SectionLabel>Case notes</SectionLabel>
                <textarea
                  className="crm-input"
                  value={caseNotes}
                  onChange={e => setCaseNotes(e.target.value)}
                  placeholder="Add investigation notes, leads, observations…"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px', lineHeight: 1.55 }}
                />
                <Button full variant="ghost" icon={Save} onClick={saveCaseNotes} disabled={savingNotes}>
                  {savingNotes ? 'Saving…' : 'Save Notes'}
                </Button>
              </div>

              {selectedReport.reward_amount != null && (
                <div>
                  <SectionLabel>Reward</SectionLabel>
                  <div style={{ fontSize: '22px', color: TONE.green, fontWeight: 700 }}>
                    ₹{selectedReport.reward_amount.toLocaleString('en-IN')}
                  </div>
                </div>
              )}

              <div>
                <SectionLabel>Timeline</SectionLabel>
                <div style={{ fontSize: '12.5px', color: C.heading, marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>Reported:</span> {new Date(selectedReport.reported_at).toLocaleString('en-IN')}
                </div>
                {selectedReport.resolved_at && (
                  <div style={{ fontSize: '12.5px', color: TONE.green }}>
                    <span style={{ fontWeight: 600 }}>Resolved:</span> {new Date(selectedReport.resolved_at).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </Page>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 700, color: C.label,
      letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '8px',
    }}>
      {children}
    </div>
  )
}
