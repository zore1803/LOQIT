import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Colors } from '../lib/colors'
import { supabase } from '../lib/supabase'
import { Card } from '../components/Card'

type HistoryEvent = {
  id: string
  type: 'registered' | 'lost' | 'detection' | 'chat' | 'recovered' | 'status_change'
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
}

type Device = {
  id: string
  make: string
  model: string
  serial_number: string
  status: string
  created_at: string
}

export function DeviceHistoryPage() {
  const navigate = useNavigate()
  const { deviceId } = useParams<{ deviceId: string }>()
  const [device, setDevice] = useState<Device | null>(null)
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) return
    loadHistory()
  }, [deviceId])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const { data: dev } = await supabase
        .from('devices')
        .select('id, make, model, serial_number, status, created_at')
        .eq('id', deviceId)
        .single()
      if (!dev) return
      setDevice(dev as Device)

      const history: HistoryEvent[] = []

      // Registration event
      history.push({
        id: 'reg',
        type: 'registered',
        title: 'Device Registered',
        description: `${dev.make} ${dev.model} registered on LOQIT with serial number ${dev.serial_number}`,
        timestamp: dev.created_at,
        icon: 'add_circle',
        color: Colors.secondary,
      })

      // Lost reports
      const { data: reports } = await supabase
        .from('lost_reports')
        .select('id, reported_at, resolved_at, incident_description, case_status, last_known_address')
        .eq('device_id', deviceId)
        .order('reported_at', { ascending: true })

      if (reports) {
        for (const r of reports) {
          history.push({
            id: `lost-${r.id}`,
            type: 'lost',
            title: 'Reported Lost/Stolen',
            description: r.incident_description || `Device reported lost. Last known: ${r.last_known_address || 'Unknown'}`,
            timestamp: r.reported_at,
            icon: 'report_problem',
            color: Colors.error,
          })
          if (r.resolved_at) {
            history.push({
              id: `resolved-${r.id}`,
              type: 'recovered',
              title: 'Case Resolved',
              description: `Case marked as ${r.case_status || 'resolved'}`,
              timestamp: r.resolved_at,
              icon: 'check_circle',
              color: Colors.secondary,
            })
          }
        }
      }

      // Chat rooms (detection events)
      const { data: rooms } = await supabase
        .from('chat_rooms')
        .select('id, created_at, is_active')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: true })

      if (rooms) {
        for (const room of rooms) {
          history.push({
            id: `chat-${room.id}`,
            type: 'chat',
            title: 'Finder Chat Initiated',
            description: `A finder detected your device and started a recovery chat`,
            timestamp: room.created_at,
            icon: 'chat_bubble',
            color: Colors.primary,
          })
        }
      }

      // Current status
      if (dev.status === 'recovered') {
        history.push({
          id: 'current',
          type: 'recovered',
          title: 'Device Recovered',
          description: 'Device successfully recovered',
          timestamp: new Date().toISOString(),
          icon: 'verified',
          color: Colors.secondary,
        })
      }

      let filteredHistory = [...history]
      
      // Privacy: If device is lost, only show events AFTER the most recent lost report
      if (dev.status === 'lost' || dev.status === 'stolen') {
        const lastLostEvent = [...history].reverse().find(e => e.type === 'lost')
        if (lastLostEvent) {
          const lastLostTime = new Date(lastLostEvent.timestamp).getTime()
          filteredHistory = history.filter(e => new Date(e.timestamp).getTime() >= lastLostTime)
        } else {
          // If no lost event found in records but status is lost, show nothing for safety
          filteredHistory = []
        }
      }

      filteredHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      setEvents(filteredHistory)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button
          onClick={() => navigate('/devices')}
          style={{ background: 'none', border: 'none', color: Colors.onSurfaceVariant, cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: Colors.onSurface, margin: 0 }}>Device Audit Trail</h1>
          {device && <p style={{ color: Colors.onSurfaceVariant, fontSize: '15px', margin: '4px 0 0' }}>{device.make} {device.model} · Serial {device.serial_number}</p>}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: Colors.onSurfaceVariant }}>
          <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline, display: 'block', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>sync</span>
          Loading history…
        </div>
      ) : events.length === 0 ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline, display: 'block', marginBottom: '12px' }}>history</span>
          <p style={{ color: Colors.onSurfaceVariant }}>No history events found</p>
        </Card>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: '27px', top: '24px', bottom: '24px', width: '2px', background: `linear-gradient(to bottom, ${Colors.primary}88, ${Colors.outlineVariant})` }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                style={{ display: 'flex', gap: '20px', paddingBottom: i < events.length - 1 ? '24px' : '0' }}
              >
                {/* Icon node */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                  background: `${event.color}22`,
                  border: `2px solid ${event.color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1,
                  boxShadow: `0 0 0 4px ${Colors.background}`,
                }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: event.color }}>{event.icon}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: '8px' }}>
                  <Card style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: Colors.onSurface, marginBottom: '4px' }}>{event.title}</div>
                        <div style={{ fontSize: '14px', color: Colors.onSurfaceVariant, lineHeight: 1.5 }}>{event.description}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: Colors.outline, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <div>{new Date(event.timestamp).toLocaleDateString()}</div>
                        <div>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
