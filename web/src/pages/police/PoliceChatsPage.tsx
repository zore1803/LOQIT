import { useEffect, useState, useCallback } from 'react'
import { Colors } from '../../lib/colors'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { analyzeChat, ChatAnalysis } from '../../services/aiService'

type ChatRoomData = {
  id: string
  owner_id: string
  device_id: string
  is_active: boolean
  created_at: string
  riskScore?: ChatAnalysis | null
  riskLoading?: boolean
  devices: { make: string; model: string; serial_number: string } | null
  profiles: { full_name: string; phone_number: string | null } | null
}

type ChatMessage = {
  id: string
  room_id: string
  sender_role: string
  content: string
  sent_at: string
}

const RISK_COLOR: Record<string, string> = {
  Low: Colors.secondary,
  Medium: Colors.tertiary,
  High: Colors.error,
}

const RISK_BG: Record<string, string> = {
  Low: Colors.secondary + '22',
  Medium: Colors.tertiary + '22',
  High: Colors.error + '22',
}

function RiskBadge({ level }: { level: string }) {
  const color = RISK_COLOR[level] || Colors.outline
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700,
      background: RISK_BG[level] || `${Colors.outline}22`,
      border: `1px solid ${color}44`, color,
    }}>
      <span className="material-icons" style={{ fontSize: '13px' }}>
        {level === 'High' ? 'warning' : level === 'Medium' ? 'info' : 'check_circle'}
      </span>
      {level} Risk
    </span>
  )
}

export function PoliceChatsPage() {
  const [rooms, setRooms] = useState<ChatRoomData[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [analysis, setAnalysis] = useState<ChatAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [groqKeyMissing, setGroqKeyMissing] = useState(false)

  useEffect(() => { loadRooms() }, [])

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom)
      setAnalysis(null)
      setAnalysisError('')
    }
  }, [selectedRoom])

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          id, owner_id, device_id, is_active, created_at,
          devices(make, model, serial_number),
          profiles(full_name, phone_number)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      const transformed = (data as any[]).map(r => ({
        ...r,
        devices: Array.isArray(r.devices) ? r.devices[0] : r.devices,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
        riskScore: null, riskLoading: false,
      }))
      setRooms(transformed as ChatRoomData[])
    } catch (error) {
      console.error('Error loading rooms:', error)
    } finally { setLoading(false) }
  }

  const loadMessages = async (roomId: string) => {
    setMessagesLoading(true)
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_role, content, sent_at')
        .eq('room_id', roomId)
        .order('sent_at', { ascending: true })
      if (error) throw error
      setMessages((data as ChatMessage[]) || [])
      // Auto-analyze after loading messages
      if (data && data.length >= 2) {
        autoAnalyze(roomId, data as ChatMessage[])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally { setMessagesLoading(false) }
  }

  const autoAnalyze = useCallback(async (roomId: string, msgs: ChatMessage[]) => {
    const realMsgs = msgs.filter(m => m.sender_role !== 'system' && m.content)
    if (realMsgs.length < 2) return
    setAnalysisLoading(true)
    setAnalysisError('')
    try {
      const result = await analyzeChat(realMsgs as any)
      setAnalysis(result)
      // Update the room's risk score in list
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, riskScore: result } : r))
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('GROQ_API_KEY') || msg.includes('Missing') || msg.includes('401')) {
        setGroqKeyMissing(true)
        setAnalysisError('Groq API key not configured. Add VITE_GROQ_API_KEY to environment variables.')
      } else {
        setAnalysisError('AI analysis unavailable: ' + msg)
      }
    } finally { setAnalysisLoading(false) }
  }, [])

  const manualAnalyze = () => {
    if (selectedRoom && messages.length >= 2) {
      autoAnalyze(selectedRoom, messages)
    }
  }

  const selectedRoomData = rooms.find(r => r.id === selectedRoom)

  return (
    <div style={{ padding: '32px', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '32px', fontWeight: 700, color: Colors.onSurface, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-icons" style={{ fontSize: '36px', color: Colors.primary }}>chat</span>
          Chat Surveillance
        </div>
        <div style={{ fontSize: '15px', color: Colors.onSurfaceVariant }}>
          Monitor all finder-owner conversations. AI risk scoring runs automatically.
        </div>
      </div>

      {groqKeyMissing && (
        <div style={{
          background: `${Colors.tertiary}18`, border: `1px solid ${Colors.tertiary}44`,
          borderRadius: '12px', padding: '14px 18px', marginBottom: '24px',
          display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: Colors.tertiary,
        }}>
          <span className="material-icons" style={{ fontSize: '20px' }}>info</span>
          <div>
            <strong>AI Risk Scoring:</strong> Add <code style={{ background: `${Colors.tertiary}22`, padding: '2px 6px', borderRadius: '4px' }}>VITE_GROQ_API_KEY</code> to your environment variables to enable automatic chat risk analysis.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', height: 'calc(100vh - 220px)' }}>
        {/* Room list */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: Colors.onSurfaceVariant }}>
              <span className="material-icons" style={{ fontSize: '40px', color: Colors.outline, display: 'block', marginBottom: '8px', animation: 'spin 1s linear infinite' }}>sync</span>
              Loading…
            </div>
          ) : rooms.length === 0 ? (
            <Card style={{ padding: '40px', textAlign: 'center' }}>
              <span className="material-icons" style={{ fontSize: '40px', color: Colors.outline, display: 'block', marginBottom: '8px' }}>chat_bubble_outline</span>
              <p style={{ color: Colors.onSurfaceVariant, margin: 0 }}>No chat rooms yet</p>
            </Card>
          ) : rooms.map(room => (
            <Card
              key={room.id}
              onClick={() => setSelectedRoom(room.id)}
              style={{
                padding: '14px 16px', cursor: 'pointer',
                border: `1px solid ${selectedRoom === room.id ? Colors.primary + '66' : Colors.outlineVariant}`,
                background: selectedRoom === room.id ? `${Colors.primary}10` : Colors.surfaceContainerLow,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: Colors.onSurface }}>
                  {room.devices?.make} {room.devices?.model}
                </div>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
                  background: room.is_active ? Colors.secondary : Colors.outline,
                  boxShadow: room.is_active ? `0 0 6px ${Colors.secondary}` : 'none',
                }} />
              </div>
              <div style={{ fontSize: '12px', color: Colors.outline, marginBottom: '8px' }}>
                Owner: {room.profiles?.full_name}
              </div>
              {room.riskScore && <RiskBadge level={room.riskScore.riskLevel} />}
              {!room.riskScore && (
                <span style={{ fontSize: '11px', color: Colors.outline }}>
                  {new Date(room.created_at).toLocaleDateString()}
                </span>
              )}
            </Card>
          ))}
        </div>

        {/* Chat panel + analysis */}
        {selectedRoom ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: analysis ? '1fr 320px' : '1fr', gap: '16px', flex: 1, overflow: 'hidden' }}>
              {/* Messages */}
              <Card style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${Colors.outlineVariant}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: Colors.onSurface }}>
                      {selectedRoomData?.devices?.make} {selectedRoomData?.devices?.model}
                    </div>
                    <div style={{ fontSize: '12px', color: Colors.outline }}>
                      Owner: {selectedRoomData?.profiles?.full_name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {analysis && <RiskBadge level={analysis.riskLevel} />}
                    <Button
                      variant="outline"
                      onClick={manualAnalyze}
                      loading={analysisLoading}
                      icon="psychology"
                      size="small"
                    >
                      {analysisLoading ? 'Analyzing…' : 'Re-analyze'}
                    </Button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {messagesLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: Colors.onSurfaceVariant }}>
                      <span className="material-icons" style={{ fontSize: '36px', color: Colors.outline, display: 'block', marginBottom: '8px', animation: 'spin 1s linear infinite' }}>sync</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: Colors.onSurfaceVariant }}>
                      <span className="material-icons" style={{ fontSize: '36px', color: Colors.outline, display: 'block', marginBottom: '8px' }}>chat_bubble_outline</span>
                      No messages yet
                    </div>
                  ) : messages.map(msg => (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: msg.sender_role === 'system' ? 'center' : msg.sender_role === 'owner' ? 'flex-end' : 'flex-start',
                    }}>
                      {msg.sender_role === 'system' ? (
                        <span style={{ fontSize: '11px', color: Colors.outline, background: Colors.surfaceContainerHigh, padding: '4px 12px', borderRadius: '100px' }}>
                          {msg.content}
                        </span>
                      ) : (
                        <div style={{
                          maxWidth: '70%',
                          background: msg.sender_role === 'owner' ? Colors.primaryContainer : Colors.surfaceContainerHigh,
                          borderRadius: '14px', padding: '10px 14px',
                        }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: Colors.outline, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {msg.sender_role}
                          </div>
                          <div style={{ fontSize: '14px', color: Colors.onSurface }}>{msg.content}</div>
                          <div style={{ fontSize: '10px', color: Colors.outline, marginTop: '4px' }}>
                            {new Date(msg.sent_at).toLocaleTimeString()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Analysis panel */}
              {analysis && (
                <Card style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${Colors.outlineVariant}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons" style={{ fontSize: '20px', color: Colors.primary }}>psychology</span>
                    <span style={{ fontWeight: 700, color: Colors.onSurface, fontSize: '15px' }}>AI Risk Analysis</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      background: RISK_BG[analysis.riskLevel] || `${Colors.outline}22`,
                      border: `1px solid ${(RISK_COLOR[analysis.riskLevel] || Colors.outline) + '44'}`,
                      borderRadius: '12px', padding: '14px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Risk Level</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: RISK_COLOR[analysis.riskLevel] || Colors.outline }}>
                        {analysis.riskLevel}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Summary</div>
                      <div style={{ fontSize: '13px', color: Colors.onSurface, lineHeight: '1.6', background: Colors.surfaceContainerHigh, borderRadius: '10px', padding: '12px' }}>
                        {analysis.summary}
                      </div>
                    </div>

                    {analysis.redFlags && analysis.redFlags.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Red Flags</div>
                        {analysis.redFlags.map((flag, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                            <span className="material-icons" style={{ fontSize: '16px', color: Colors.error, flexShrink: 0, marginTop: '1px' }}>flag</span>
                            <span style={{ fontSize: '13px', color: Colors.onSurface }}>{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {analysis.actionableInsights && (
                      <div>
                        <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Actionable Intel</div>
                        {Object.entries(analysis.actionableInsights)
                          .filter(([, v]) => v && v !== 'Not mentioned' && v !== 'None' && v !== 'N/A')
                          .map(([k, v]) => (
                            <div key={k} style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '11px', color: Colors.outline, textTransform: 'capitalize', marginBottom: '2px' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                              <div style={{ fontSize: '13px', color: Colors.onSurface, fontWeight: 500 }}>{v as string}</div>
                            </div>
                          ))}
                      </div>
                    )}

                    <div style={{ background: `${Colors.primary}18`, border: `1px solid ${Colors.primary}33`, borderRadius: '12px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', color: Colors.outline, marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Recommendation</div>
                      <div style={{ fontSize: '13px', color: Colors.onSurface, lineHeight: '1.5' }}>{analysis.recommendation}</div>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Analysis error */}
            {analysisError && !analysis && (
              <div style={{
                background: `${Colors.tertiary}18`, border: `1px solid ${Colors.tertiary}44`,
                borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: Colors.tertiary,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>info</span>
                {analysisError}
              </div>
            )}

            {analysisLoading && !analysis && (
              <div style={{
                background: `${Colors.primary}18`, border: `1px solid ${Colors.primary}33`,
                borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: Colors.primary,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>psychology</span>
                Running AI risk analysis…
              </div>
            )}
          </div>
        ) : (
          <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
            <span className="material-icons" style={{ fontSize: '56px', color: Colors.outline }}>chat_bubble_outline</span>
            <p style={{ color: Colors.onSurfaceVariant, fontSize: '16px', margin: 0 }}>Select a chat room to monitor</p>
            <p style={{ color: Colors.outline, fontSize: '13px', margin: 0, textAlign: 'center', maxWidth: '280px' }}>
              AI risk scoring runs automatically when you open a conversation
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
