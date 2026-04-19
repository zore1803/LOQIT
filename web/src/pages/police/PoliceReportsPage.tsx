import { useEffect, useState } from 'react'
import { Colors } from '../../lib/colors'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { generateCaseSummary } from '../../services/aiService'

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

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; icon: string }> = {
  unassigned: { label: 'Unassigned', color: Colors.outline, icon: 'inbox' },
  under_investigation: { label: 'Under Investigation', color: Colors.tertiary, icon: 'manage_search' },
  resolved: { label: 'Resolved', color: Colors.secondary, icon: 'check_circle' },
  closed: { label: 'Closed', color: Colors.primary, icon: 'lock' },
}

function StatusBadge({ status }: { status: CaseStatus | null }) {
  const cfg = STATUS_CONFIG[status || 'unassigned']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '100px',
      background: `${cfg.color}22`, border: `1px solid ${cfg.color}44`,
      fontSize: '12px', fontWeight: 600, color: cfg.color,
    }}>
      <span className="material-icons" style={{ fontSize: '14px' }}>{cfg.icon}</span>
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
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['police', 'admin'])
    setOfficers((data as OfficerProfile[]) || [])
  }

  const loadReports = async () => {
    setLoading(true)
    try {
      let query = supabase
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
      const { error } = await supabase
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
      const { error } = await supabase.from('lost_reports').update(updates).eq('id', selectedReport.id)
      if (error) throw error
      await loadReports()
      setSelectedReport(prev => prev ? { ...prev, case_status: status } : prev)
    } catch (err) { console.error('Error updating status:', err) }
  }

  const saveCaseNotes = async () => {
    if (!selectedReport) return
    setSavingNotes(true)
    try {
      const { error } = await supabase.from('lost_reports').update({ case_notes: caseNotes }).eq('id', selectedReport.id)
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
    <div style={{ padding: '32px', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '32px', fontWeight: 700, color: Colors.onSurface, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-icons" style={{ fontSize: '36px', color: Colors.error }}>assignment</span>
          Case Management
        </div>
        <div style={{ fontSize: '15px', color: Colors.onSurfaceVariant }}>
          Assign officers, track investigation status, and manage case notes.
        </div>
        {unassignedCount > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '12px',
            background: `${Colors.error}18`, border: `1px solid ${Colors.error}44`,
            borderRadius: '10px', padding: '8px 16px', fontSize: '14px', color: Colors.error, fontWeight: 600,
          }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>warning</span>
            {unassignedCount} unassigned case{unassignedCount !== 1 ? 's' : ''} need attention
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {(['active', 'resolved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            backgroundColor: filter === f ? Colors.primary : Colors.surfaceContainerHigh,
            color: filter === f ? Colors.onPrimary : Colors.onSurfaceVariant,
            border: `1px solid ${filter === f ? Colors.primary : Colors.outlineVariant}`, transition: 'all 0.2s ease',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedReport ? '1fr 460px' : '1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: Colors.onSurfaceVariant }}>
              <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline, display: 'block', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>sync</span>
              Loading cases…
            </div>
          ) : reports.length === 0 ? (
            <Card style={{ padding: '60px', textAlign: 'center' }}>
              <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline, display: 'block', marginBottom: '12px' }}>inbox</span>
              <p style={{ color: Colors.onSurfaceVariant }}>No reports found</p>
            </Card>
          ) : reports.map(r => (
            <Card key={r.id} onClick={() => handleSelectReport(r)} style={{
              padding: '20px', cursor: 'pointer',
              border: `1px solid ${selectedReport?.id === r.id ? Colors.primary + '66' : Colors.outlineVariant}`,
              background: selectedReport?.id === r.id ? `${Colors.primary}10` : Colors.surfaceContainerLow,
              transition: 'all 0.2s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: Colors.onSurface, marginBottom: '4px' }}>
                    {r.devices?.[0]?.make} {r.devices?.[0]?.model}
                  </div>
                  <div style={{ fontSize: '13px', color: Colors.outline, marginBottom: '10px' }}>
                    Serial: {r.devices?.[0]?.serial_number} · {r.profiles?.[0]?.full_name}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusBadge status={r.case_status || 'unassigned'} />
                    {r.assigned_officer_id && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                        color: Colors.primary, background: `${Colors.primary}18`,
                        border: `1px solid ${Colors.primary}44`, borderRadius: '100px', padding: '3px 10px',
                      }}>
                        <span className="material-icons" style={{ fontSize: '14px' }}>person</span>
                        {assignedOfficerName(r)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: Colors.outline }}>
                    {new Date(r.reported_at).toLocaleDateString()}
                  </div>
                  {r.reward_amount && (
                    <div style={{ fontSize: '14px', color: Colors.secondary, fontWeight: 700, marginTop: '4px' }}>
                      ₹{r.reward_amount.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {selectedReport && (
          <Card style={{ padding: '0', overflow: 'hidden', alignSelf: 'flex-start', position: 'sticky', top: '24px' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${Colors.outlineVariant}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '18px', color: Colors.onSurface }}>Case Detail</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={exportEvidencePDF}
                  disabled={exportingPDF}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: 'none', background: `${Colors.primary}22`, color: Colors.primary, cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>{exportingPDF ? 'sync' : 'picture_as_pdf'}</span>
                  {exportingPDF ? 'Generating…' : 'Export PDF'}
                </button>
                <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Colors.outline, padding: '4px' }}>
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '78vh', overflowY: 'auto' }}>
              <div>
                <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Device</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{selectedReport.devices?.[0]?.make} {selectedReport.devices?.[0]?.model}</div>
                <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, marginTop: '2px' }}>Serial: {selectedReport.devices?.[0]?.serial_number}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Case Status</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(Object.keys(STATUS_CONFIG) as CaseStatus[]).map(s => (
                    <button key={s} onClick={() => updateCaseStatus(s)} style={{
                      padding: '7px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                      background: selectedReport.case_status === s ? `${STATUS_CONFIG[s].color}33` : Colors.surfaceContainerHigh,
                      color: selectedReport.case_status === s ? STATUS_CONFIG[s].color : Colors.onSurfaceVariant,
                      border: `1px solid ${selectedReport.case_status === s ? STATUS_CONFIG[s].color + '66' : Colors.outlineVariant}`,
                      transition: 'all 0.2s',
                    }}>
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Assign Officer</div>
                <select value={selectedOfficerId} onChange={e => setSelectedOfficerId(e.target.value)} style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  background: Colors.surfaceContainerHigh, color: Colors.onSurface,
                  border: `1px solid ${Colors.outlineVariant}`, fontSize: '14px',
                  marginBottom: '10px', outline: 'none',
                }}>
                  <option value="">— Unassigned —</option>
                  {officers.map(o => <option key={o.id} value={o.id}>{o.full_name || 'Officer'}</option>)}
                </select>
                <Button fullWidth onClick={assignOfficer} loading={assigningOfficer} disabled={!selectedOfficerId} icon="person_add">
                  {selectedReport.assigned_officer_id ? 'Reassign Officer' : 'Assign Officer'}
                </Button>
                {selectedReport.assigned_officer_id && (
                  <div style={{ fontSize: '13px', color: Colors.secondary, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                    Assigned to {assignedOfficerName(selectedReport)}
                  </div>
                )}
              </div>

              <div style={{ height: '1px', background: Colors.outlineVariant }} />

              <div>
                <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Owner</div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{selectedReport.profiles?.[0]?.full_name}</div>
                {selectedReport.profiles?.[0]?.phone_number && (
                  <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, marginTop: '4px' }}>{selectedReport.profiles[0].phone_number}</div>
                )}
              </div>

              {selectedReport.incident_description && (
                <div>
                  <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Incident</div>
                  <div style={{ fontSize: '14px', color: Colors.onSurface, lineHeight: '1.6', background: Colors.surfaceContainerHigh, borderRadius: '10px', padding: '12px' }}>
                    {selectedReport.incident_description}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Case Notes</div>
                <textarea value={caseNotes} onChange={e => setCaseNotes(e.target.value)} placeholder="Add investigation notes, leads, observations…" rows={4} style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  background: Colors.surfaceContainerHigh, color: Colors.onSurface,
                  border: `1px solid ${Colors.outlineVariant}`, fontSize: '14px',
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  marginBottom: '10px', boxSizing: 'border-box',
                }} />
                <Button fullWidth onClick={saveCaseNotes} loading={savingNotes} variant="outline" icon="save">Save Notes</Button>
              </div>

              {selectedReport.reward_amount && (
                <div>
                  <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Reward</div>
                  <div style={{ fontSize: '28px', color: Colors.secondary, fontWeight: 700 }}>₹{selectedReport.reward_amount.toLocaleString()}</div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Timeline</div>
                <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>Reported:</span> {new Date(selectedReport.reported_at).toLocaleString()}
                </div>
                {selectedReport.resolved_at && (
                  <div style={{ fontSize: '14px', color: Colors.secondary }}>
                    <span style={{ fontWeight: 600 }}>Resolved:</span> {new Date(selectedReport.resolved_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
