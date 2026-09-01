import { useEffect, useState, useCallback } from 'react'
import {
  MessagesSquare, Smartphone, ShieldAlert, Info, CheckCircle2, Sparkles,
  AlertCircle, RefreshCw, MapPin, Clock, Banknote, Phone, User,
} from 'lucide-react'
import { db } from '../../lib/db'
import { analyzeChat, ChatAnalysis } from '../../services/aiService'
import {
  C, TONE, Page, PageHeader, Card, CardHeader, Button, Badge,
  Skeleton, EmptyState, IconTile,
} from '../../components/crm'

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

const RISK_TONE: Record<string, string> = {
  Low: TONE.green,
  Medium: TONE.amber,
  High: TONE.red,
}

function RiskBadge({ level }: { level: string }) {
  const tone = RISK_TONE[level] || TONE.grey
  const Icon = level === 'High' ? ShieldAlert : level === 'Medium' ? Info : CheckCircle2
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
      background: tone + '14', color: tone, border: '1px solid ' + tone + '33',
    }}>
      <Icon size={12} />
      {level} risk
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
      const { data, error } = await db
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
      const { data, error } = await db
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

  const activeRooms = rooms.filter(r => r.is_active).length
  const flagged = rooms.filter(r => r.riskScore?.riskLevel === 'High').length

  return (
    <Page>
      <PageHeader
        title="All Chats"
        subtitle="Owner and finder conversations, screened for risk"
      />

      {groqKeyMissing && (
        <Card style={{ padding: '13px 18px', marginBottom: '20px', background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <AlertCircle size={16} color={TONE.amber} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#92400E', fontWeight: 500 }}>
              AI screening is off — VITE_GROQ_API_KEY is not configured. Chats are still readable.
            </span>
          </div>
        </Card>
      )}

      <div className="crm-c3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'contents' }}>
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <MessagesSquare size={16} color={TONE.blue} />
              <p style={{ fontSize: '13px', color: C.label, fontWeight: 500, margin: 0 }}>Total Conversations</p>
            </div>
            {loading ? <Skeleton width={56} height={28} /> : (
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: C.heading, margin: 0 }}>{rooms.length}</h3>
            )}
          </Card>
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <MessagesSquare size={16} color={TONE.green} />
              <p style={{ fontSize: '13px', color: C.label, fontWeight: 500, margin: 0 }}>Active</p>
            </div>
            {loading ? <Skeleton width={56} height={28} /> : (
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: C.heading, margin: 0 }}>{activeRooms}</h3>
            )}
          </Card>
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ShieldAlert size={16} color={flagged ? TONE.red : TONE.grey} />
              <p style={{ fontSize: '13px', color: C.label, fontWeight: 500, margin: 0 }}>Flagged High Risk</p>
            </div>
            {loading ? <Skeleton width={56} height={28} /> : (
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: C.heading, margin: 0 }}>{flagged}</h3>
            )}
          </Card>
        </div>
      </div>

      <div className="crm-split" style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: '20px', alignItems: 'start' }}>

        {/* Conversation list */}
        <Card style={{ overflow: 'hidden' }}>
          <CardHeader title="Conversations" subtitle="Newest first" />
          <div style={{ borderTop: '1px solid var(--crm-border)', maxHeight: '640px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: '11px' }}>
                    <Skeleton width={34} height={34} radius={10} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width="55%" height={12} />
                      <Skeleton width="40%" height={10} style={{ marginTop: '6px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <EmptyState icon={MessagesSquare} title="No conversations" body="Chats open when a finder contacts a device owner." />
            ) : (
              rooms.map((room, i) => {
                const active = selectedRoom === room.id
                return (
                  <div
                    key={room.id}
                    className={active ? undefined : 'crm-row'}
                    onClick={() => setSelectedRoom(room.id)}
                    style={{
                      display: 'flex', gap: '11px', padding: '13px 20px', cursor: 'pointer',
                      borderBottom: i < rooms.length - 1 ? '1px solid var(--crm-border)' : 'none',
                      background: active ? 'rgba(39,118,234,.05)' : undefined,
                    }}
                  >
                    <IconTile icon={Smartphone} tone={room.is_active ? TONE.green : TONE.grey} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: C.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {room.devices?.make} {room.devices?.model}
                      </div>
                      <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {room.profiles?.full_name || 'Unknown owner'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {!room.is_active && <Badge tone={TONE.grey}>Closed</Badge>}
                        {room.riskScore && <RiskBadge level={room.riskScore.riskLevel} />}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Transcript + analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!selectedRoom ? (
            <Card>
              <EmptyState
                icon={MessagesSquare}
                title="Select a conversation"
                body="Pick a chat on the left to read the transcript and its AI risk assessment."
              />
            </Card>
          ) : (
            <>
              <Card style={{ overflow: 'hidden' }}>
                <CardHeader
                  title={selectedRoomData ? `${selectedRoomData.devices?.make} ${selectedRoomData.devices?.model}` : 'Transcript'}
                  subtitle={selectedRoomData?.devices?.serial_number ? 'Serial ' + selectedRoomData.devices.serial_number : undefined}
                  action={selectedRoomData?.profiles?.full_name
                    ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.label }}>
                        <User size={13} color={C.muted} />
                        {selectedRoomData.profiles.full_name}
                      </span>
                    )
                    : undefined}
                />
                <div style={{
                  borderTop: '1px solid var(--crm-border)',
                  maxHeight: '420px', overflowY: 'auto',
                  padding: '16px 20px', background: 'var(--crm-tile)',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  {messagesLoading ? (
                    [0, 1, 2].map(i => <Skeleton key={i} width="60%" height={40} radius={12} />)
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 0', fontSize: '13px', color: C.muted }}>
                      No messages in this conversation yet.
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isOwner = msg.sender_role === 'owner'
                      const isSystem = msg.sender_role === 'system'
                      if (isSystem) {
                        return (
                          <div key={msg.id} style={{ textAlign: 'center', fontSize: '11px', color: C.muted, padding: '4px 0' }}>
                            {msg.content}
                          </div>
                        )
                      }
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isOwner ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '76%', padding: '9px 13px', borderRadius: '14px',
                            background: isOwner ? C.primary : 'var(--crm-card)',
                            color: isOwner ? '#fff' : C.heading,
                            border: isOwner ? 'none' : '1px solid var(--crm-tile-border)',
                            fontSize: '13px', lineHeight: 1.5,
                          }}>
                            <div style={{
                              fontSize: '10px', fontWeight: 700, letterSpacing: '.4px',
                              opacity: .7, marginBottom: '3px', textTransform: 'uppercase',
                            }}>
                              {msg.sender_role}
                            </div>
                            {msg.content}
                            <div style={{ fontSize: '10px', opacity: .6, marginTop: '4px', textAlign: 'right' }}>
                              {new Date(msg.sent_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>

              {/* AI analysis */}
              <Card>
                <CardHeader
                  title="AI Risk Assessment"
                  subtitle="Generated from the transcript by Llama 3.3 via Groq"
                  action={
                    <Button variant="ghost" icon={analysisLoading ? RefreshCw : Sparkles} onClick={manualAnalyze} disabled={analysisLoading || messages.length < 2}>
                      {analysisLoading ? 'Analysing…' : 'Re-analyse'}
                    </Button>
                  }
                />
                <div style={{ padding: '0 24px 22px' }}>
                  {analysisLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <Skeleton width="30%" height={22} radius={999} />
                      <Skeleton width="100%" height={12} />
                      <Skeleton width="85%" height={12} />
                    </div>
                  ) : analysisError ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '11px 14px', borderRadius: '12px',
                      background: '#FFFBEB', border: '1px solid #FDE68A',
                      color: '#92400E', fontSize: '12.5px',
                    }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      {analysisError}
                    </div>
                  ) : !analysis ? (
                    <p style={{ fontSize: '13px', color: C.muted, margin: 0 }}>
                      {messages.length < 2
                        ? 'Not enough messages to assess yet.'
                        : 'No assessment yet — run one with Re-analyse.'}
                    </p>
                  ) : (
                    <>
                      <div style={{ marginBottom: '14px' }}>
                        <RiskBadge level={analysis.riskLevel} />
                      </div>

                      <p style={{ fontSize: '13px', color: C.heading, lineHeight: 1.65, margin: '0 0 16px' }}>
                        {analysis.summary}
                      </p>

                      {analysis.redFlags?.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: C.label, letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: '8px' }}>
                            Red flags
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {analysis.redFlags.map((flag, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                padding: '9px 12px', borderRadius: '10px',
                                background: '#FEF2F2', border: '1px solid #FECACA',
                                fontSize: '12.5px', color: '#991B1B', lineHeight: 1.5,
                              }}>
                                <ShieldAlert size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                                {flag}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.actionableInsights && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: C.label, letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: '8px' }}>
                            Extracted details
                          </div>
                          <div style={{ background: 'var(--crm-tile)', border: '1px solid var(--crm-tile-border)', borderRadius: '12px', overflow: 'hidden' }}>
                            {[
                              { icon: MapPin, label: 'Location', value: analysis.actionableInsights.location },
                              { icon: Clock, label: 'Meeting time', value: analysis.actionableInsights.meetingTime },
                              { icon: Banknote, label: 'Reward discussed', value: analysis.actionableInsights.rewardDiscussed },
                              { icon: Phone, label: 'Contact shared', value: analysis.actionableInsights.contactInfo },
                            ].filter(r => r.value).map((row, i, arr) => (
                              <div key={row.label} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 14px',
                                borderBottom: i < arr.length - 1 ? '1px solid var(--crm-tile-border)' : 'none',
                              }}>
                                <row.icon size={14} color={C.muted} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '12px', color: C.label, flex: 1 }}>{row.label}</span>
                                <span style={{ fontSize: '12.5px', fontWeight: 500, color: C.heading, textAlign: 'right' }}>
                                  {row.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.recommendation && (
                        <div style={{
                          padding: '12px 14px', borderRadius: '12px',
                          background: '#EFF6FF', border: '1px solid #BFDBFE',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: '5px' }}>
                            Recommendation
                          </div>
                          <p style={{ fontSize: '12.5px', color: '#1D4ED8', margin: 0, lineHeight: 1.6 }}>
                            {analysis.recommendation}
                          </p>
                        </div>
                      )}

                      <p style={{ fontSize: '11px', color: C.muted, margin: '14px 0 0', lineHeight: 1.5 }}>
                        Generated by a language model. Treat it as a lead to verify, not as evidence.
                      </p>
                    </>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
