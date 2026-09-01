// Simplified Analytics Page - Final Corrected Version
import { useEffect, useState } from 'react'
import { Colors } from '../../lib/colors'
import { db } from '../../lib/db'
import { useNavigate } from 'react-router-dom'

type AnalyticsData = {
  devicesByStatus: { status: string; count: number }[]
  devicesByMake: { make: string; count: number }[]
  reportsOverTime: { month: string; count: number }[]
  recoveryRate: number
  averageResolutionDays: number
  theftHotspots: { zone: string; count: number; probability: number }[]
}

function SummaryCard({ label, value, description, icon, color }: {
  label: string; value: string | number; description: string; icon: string; color: string
}) {
  return (
    <div style={{
      background: Colors.surfaceContainer,
      borderRadius: '20px',
      padding: '30px',
      border: `1px solid ${Colors.outlineVariant}`,
      flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="material-icons" style={{ color, fontSize: '24px' }}>{icon}</span>
        </div>
        <span style={{ fontSize: '15px', fontWeight: 700, color: Colors.onSurface }}>{label}</span>
      </div>
      <div style={{ fontSize: '40px', fontWeight: 900, color: Colors.onSurface, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '14px', color: Colors.onSurfaceVariant, marginTop: '8px', fontWeight: 500 }}>{description}</div>
    </div>
  )
}

export function PoliceAnalyticsPage() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    devicesByStatus: [],
    devicesByMake: [],
    reportsOverTime: [],
    recoveryRate: 0,
    averageResolutionDays: 0,
    theftHotspots: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAnalytics() }, [])

  const loadAnalytics = async () => {
    try {
      const { data: devices } = await db.from('devices').select('status')
      const statusCounts: { [key: string]: number } = {}
      devices?.forEach((d: any) => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1 })
      const devicesByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

      const { data: allDevices } = await db.from('devices').select('make')
      const makeCounts: { [key: string]: number } = {}
      allDevices?.forEach((d: any) => { makeCounts[d.make] = (makeCounts[d.make] || 0) + 1 })
      const devicesByMake = Object.entries(makeCounts).map(([make, count]) => ({ make, count })).sort((a,b) => b.count - a.count).slice(0, 5)

      const { data: reports } = await db.from('lost_reports')
        .select('reported_at')
        .gte('reported_at', new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString())
      const monthCounts: { [key: string]: number } = {}
      reports?.forEach((r: any) => {
        const d = new Date(r.reported_at)
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
        monthCounts[key] = (monthCounts[key] || 0) + 1
      })
      const reportsOverTime = Object.entries(monthCounts).sort(([a],[b])=>a.localeCompare(b)).map(([key, count]) => ({ 
        month: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short' }), 
        count 
      }))

      const { count: totalLost } = await db.from('devices').select('*', { count: 'exact', head: true }).in('status', ['lost', 'stolen', 'found', 'recovered'])
      const { count: recovered } = await db.from('devices').select('*', { count: 'exact', head: true }).in('status', ['found', 'recovered'])
      const { data: resolvedReports } = await db.from('lost_reports').select('reported_at, resolved_at').not('resolved_at', 'is', null)
      
      let totalDays = 0
      resolvedReports?.forEach((r: any) => { totalDays += (new Date(r.resolved_at).getTime() - new Date(r.reported_at).getTime()) / (1000 * 60 * 60 * 24) })

      const { data: tamperEvents } = await db.from('anti_theft_events').select('latitude, longitude')
      const hotspots: { [key: string]: number } = {}
      tamperEvents?.forEach((ev: any) => {
        if (ev.latitude && ev.longitude) {
          const key = `${ev.latitude.toFixed(1)}°N, ${ev.longitude.toFixed(1)}°E`
          hotspots[key] = (hotspots[key] || 0) + 1
        }
      })
      const theftHotspots = Object.entries(hotspots).map(([zone, count]) => ({ zone, count, probability: Math.min(95, 20 + count * 15) })).sort((a,b)=>b.count-a.count).slice(0, 5)

      setAnalytics({
        devicesByStatus, devicesByMake, reportsOverTime,
        recoveryRate: totalLost ? Math.round((recovered! / totalLost!) * 100) : 0,
        averageResolutionDays: resolvedReports?.length ? Math.round(totalDays / resolvedReports.length) : 0,
        theftHotspots,
      })
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}><span className="material-icons" style={{ fontSize: '40px', animation: 'spin 2s linear infinite' }}>sync</span></div>

  const lostCount = analytics.devicesByStatus.filter(s => s.status === 'lost' || s.status === 'stolen').reduce((a,b)=>a+b.count, 0)
  const recoveredCount = analytics.devicesByStatus.filter(s => s.status === 'recovered' || s.status === 'found').reduce((a,b)=>a+b.count, 0)

  return (
    <div style={{ padding: '50px', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', backgroundColor: Colors.background }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 900, margin: 0, color: Colors.onSurface }}>Police Analytics</h1>
          <p style={{ fontSize: '16px', color: Colors.onSurfaceVariant, marginTop: '8px' }}>Tracking theft patterns and recovery performance</p>
        </div>
        <button 
          onClick={() => navigate('/police')}
          style={{ padding: '14px 28px', borderRadius: '14px', background: Colors.primary, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}
        >
          Exit to Dashboard
        </button>
      </div>

      {/* Main KPI cards */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
        <SummaryCard label="Recovery Rate" value={`${analytics.recoveryRate}%`} description={`${recoveredCount} devices found out of ${recoveredCount + lostCount}`} icon="check_circle" color={Colors.secondary} />
        <SummaryCard label="Average Recovery Time" value={`${analytics.averageResolutionDays} Days`} description="From initial report to safe recovery" icon="timer" color={Colors.primary} />
        <SummaryCard label="Unrecovered Devices" value={lostCount} description="Total devices currently marked as missing" icon="warning" color={Colors.error} />
      </div>

      <div className="r-grid-main-side" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
        
        {/* Monthly Chart */}
        <div style={{ background: Colors.surfaceContainer, padding: '30px', borderRadius: '24px', border: `1px solid ${Colors.outlineVariant}` }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 30px 0' }}>Thefts Reported Per Month</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '220px', gap: '20px', paddingBottom: '10px' }}>
            {analytics.reportsOverTime.map(item => {
              const max = Math.max(...analytics.reportsOverTime.map(r => r.count), 1)
              return (
                <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '100%', height: `${(item.count/max)*100}%`, background: Colors.primary, borderRadius: '6px', minHeight: '4px' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: Colors.onSurfaceVariant }}>{item.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Hotspots */}
        <div style={{ background: Colors.surfaceContainer, padding: '30px', borderRadius: '24px', border: `1px solid ${Colors.outlineVariant}` }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 30px 0' }}>High Theft Probabilities</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {analytics.theftHotspots.length > 0 ? analytics.theftHotspots.map(item => (
              <div key={item.zone} style={{ padding: '15px', borderRadius: '14px', background: Colors.surfaceContainerHigh, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>{item.zone}</div>
                  <div style={{ fontSize: '12px', color: Colors.onSurfaceVariant }}>{item.count} suspicious incidents</div>
                </div>
                <div style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: `${Colors.error}15`, color: Colors.error, fontSize: '11px', fontWeight: 900 }}>DANGER</div>
              </div>
            )) : <p style={{ color: Colors.onSurfaceVariant, fontSize: '14px' }}>No hotspots detected yet.</p>}
          </div>
        </div>

      </div>

      {/* Make Distribution */}
      <div style={{ marginTop: '30px', background: Colors.surfaceContainer, padding: '30px', borderRadius: '24px', border: `1px solid ${Colors.outlineVariant}` }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 24px 0' }}>Distribution by Brand</h3>
        <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
          {analytics.devicesByMake.map(m => (
            <div key={m.make} style={{ padding: '20px', borderRadius: '16px', background: Colors.surfaceContainerHigh, minWidth: '160px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: Colors.onSurfaceVariant, marginBottom: '6px', fontWeight: 600 }}>{m.make}</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: Colors.primary }}>{m.count}</div>
              <div style={{ fontSize: '11px', color: Colors.outline, marginTop: '2px' }}>Devices</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
