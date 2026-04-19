import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Colors } from '../lib/colors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { translateMessage } from '../services/aiService'

type ChatRoom = {
  id: string
  owner_id: string
  device_id: string
  is_active: boolean
  devices: { make: string; model: string; imei_primary: string } | null
}

type ChatMessage = {
  id: string
  room_id: string
  sender_role: 'owner' | 'finder' | 'system'
  content: string | null
  is_read: boolean
  sent_at: string
  translated?: string
  translating?: boolean
}

export function ChatRoomPage() {
  const navigate = useNavigate()
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuth()

  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportingAbuse, setReportingAbuse] = useState(false)
  const [abuseReported, setAbuseReported] = useState(false)
  const [showAbuseConfirm, setShowAbuseConfirm] = useState(false)
  const [translateLang, setTranslateLang] = useState('English')
  const [showTranslateMenu, setShowTranslateMenu] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const role = user?.id === room?.owner_id ? 'owner' : 'finder'

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const markAsRead = useCallback(async () => {
    if (!roomId || !role) return
    await supabase.from('chat_messages').update({ is_read: true }).eq('room_id', roomId).neq('sender_role', role)
  }, [roomId, role])

  const fetchRoomAndMessages = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError(null)
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select('id, owner_id, device_id, is_active, devices(make, model, imei_primary)')
        .eq('id', roomId)
        .single()
      if (roomError) throw roomError
      setRoom(roomData as ChatRoom)

      const { data: msgData, error: msgError } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_role, content, is_read, sent_at')
        .eq('room_id', roomId)
        .order('sent_at', { ascending: true })
      if (msgError) throw msgError
      setMessages(msgData as ChatMessage[])

      await markAsRead()
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat')
    } finally {
      setLoading(false)
    }
  }, [roomId, markAsRead])

  useEffect(() => { fetchRoomAndMessages() }, [fetchRoomAndMessages])

  useEffect(() => {
    if (!roomId || !room?.is_active) return
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const newMessage = payload.new as ChatMessage
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev
          setTimeout(scrollToBottom, 100)
          return [...prev, newMessage]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, room?.is_active])

  const sendMessage = async () => {
    const text = messageText.trim()
    if (!roomId || !text || sending || !room?.is_active) return
    setSending(true)
    try {
      const { error } = await supabase.from('chat_messages').insert({
        room_id: roomId, sender_role: role, content: text, is_read: false,
      })
      if (error) throw error
      setMessageText('')
      const newMsg: ChatMessage = {
        id: `temp-${Date.now()}`, room_id: roomId, sender_role: role,
        content: text, is_read: false, sent_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, newMsg])
      setTimeout(scrollToBottom, 50)

      // Notify the other party about the new message
      if (role === 'finder' && room?.owner_id) {
        await supabase.from('notifications').insert({
          user_id: room.owner_id,
          title: '💬 New message from finder',
          body: text.length > 80 ? text.slice(0, 80) + '…' : text,
          type: 'chat_message',
          reference_id: roomId,
        })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send message')
    } finally { setSending(false) }
  }

  const markAsFound = async () => {
    if (!room?.device_id || !window.confirm('Mark this device as found? This will close the chat.')) return
    try {
      await supabase.from('chat_messages').insert({
        room_id: roomId, sender_role: 'system',
        content: role === 'owner' ? '✅ Device owner has marked this device as found. Chat closed.' : '✅ Finder has confirmed device recovery. Chat closed.',
        is_read: false,
      })
      await supabase.from('chat_rooms').update({ is_active: false }).eq('id', roomId)
      await supabase.from('devices').update({ status: 'recovered' }).eq('id', room.device_id)
      navigate('/chat')
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to mark as found') }
  }

  const handleReportAbuse = async () => {
    if (!roomId) return
    setReportingAbuse(true)
    try {
      await supabase.from('chat_messages').insert({
        room_id: roomId, sender_role: 'system',
        content: `⚠️ Abuse report filed by ${role}. This conversation has been flagged for review.`,
        is_read: false,
      })
      // Update room to flagged (graceful — column may not exist yet)
      try {
        await supabase.from('chat_rooms').update({ flagged_at: new Date().toISOString() }).eq('id', roomId)
      } catch { /* ignore if column doesn't exist */ }
      setAbuseReported(true)
      setShowAbuseConfirm(false)
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed to report abuse') }
    finally { setReportingAbuse(false) }
  }

  const handleTranslate = async (msgId: string, text: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translating: true } : m))
    try {
      const translated = await translateMessage(text, translateLang)
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translated, translating: false } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translating: false } : m))
    }
  }

  const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Urdu']

  const containerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', maxWidth: '900px', margin: '0 auto' }

  if (loading) return <div style={containerStyle}><div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: Colors.onSurfaceVariant }}>Loading chat…</div></div>

  if (error || !room) return (
    <div style={containerStyle}>
      <Card style={{ margin: '32px', textAlign: 'center' }}>
        <span className="material-icons" style={{ fontSize: '48px', color: Colors.error, marginBottom: '16px' }}>error</span>
        <h2 style={{ color: Colors.onSurface, marginBottom: '8px' }}>Chat Not Found</h2>
        <p style={{ color: Colors.onSurfaceVariant, marginBottom: '20px' }}>{error}</p>
        <Button onClick={() => navigate('/chat')}>Back to Chats</Button>
      </Card>
    </div>
  )

  const device = room.devices

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', borderBottom: `1px solid ${Colors.outlineVariant}`, backgroundColor: Colors.surfaceContainerLow }}>
        <button style={{ background: 'none', border: 'none', color: Colors.onSurfaceVariant, cursor: 'pointer', padding: '8px', borderRadius: '8px' }} onClick={() => navigate('/chat')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: Colors.onSurface, fontSize: '18px', fontWeight: 600 }}>
            {device?.make} {device?.model}
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: Colors.onSurfaceVariant }}>IMEI ···· {device?.imei_primary?.slice(-4) || '----'}</span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: room.is_active ? `${Colors.secondary}20` : `${Colors.error}20`, color: room.is_active ? Colors.secondary : Colors.error }}>
              {room.is_active ? 'Active' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Translate language selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowTranslateMenu(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', background: `${Colors.primary}18`, border: `1px solid ${Colors.primary}33`, color: Colors.primary, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>translate</span>
            {translateLang}
          </button>
          <AnimatePresence>
            {showTranslateMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', background: Colors.surfaceContainerHigh, border: `1px solid ${Colors.outlineVariant}`, borderRadius: '12px', padding: '6px', zIndex: 50, minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
              >
                {LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    onClick={() => { setTranslateLang(lang); setShowTranslateMenu(false) }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', background: translateLang === lang ? `${Colors.primary}22` : 'none', border: 'none', borderRadius: '8px', color: translateLang === lang ? Colors.primary : Colors.onSurface, cursor: 'pointer', fontSize: '13px', textAlign: 'left', fontWeight: translateLang === lang ? 600 : 400 }}
                  >
                    {lang}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!abuseReported ? (
          <button
            onClick={() => setShowAbuseConfirm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', background: `${Colors.error}18`, border: `1px solid ${Colors.error}33`, color: Colors.error, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>flag</span>
            Report
          </button>
        ) : (
          <span style={{ fontSize: '12px', color: Colors.error, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>flag</span>
            Reported
          </span>
        )}

        {room.is_active && (
          <Button variant="secondary" size="small" onClick={markAsFound}>
            <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
            Mark Found
          </Button>
        )}
      </header>

      {/* Abuse confirm modal */}
      <AnimatePresence>
        {showAbuseConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowAbuseConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: Colors.surfaceContainerHigh, borderRadius: '20px', padding: '28px', maxWidth: '360px', width: '90%', border: `1px solid ${Colors.error}33` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span className="material-icons" style={{ fontSize: '28px', color: Colors.error }}>flag</span>
                <h3 style={{ color: Colors.onSurface, fontWeight: 700 }}>Report Abuse</h3>
              </div>
              <p style={{ color: Colors.onSurfaceVariant, fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
                This will flag the conversation for police review and send an alert. Only file if you believe there is genuine abuse, extortion, or suspicious behavior.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowAbuseConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${Colors.outlineVariant}`, background: 'none', color: Colors.onSurfaceVariant, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleReportAbuse} disabled={reportingAbuse} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: Colors.error, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  {reportingAbuse ? 'Filing…' : 'File Report'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: Colors.onSurfaceVariant, padding: '40px' }}>
            <span className="material-icons" style={{ fontSize: '48px', color: Colors.outline, display: 'block', marginBottom: '12px' }}>chat_bubble_outline</span>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.sender_role === role
            const isSystem = msg.sender_role === 'system'
            return (
              <div
                key={msg.id}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isSystem ? 'center' : isOwn ? 'flex-end' : 'flex-start' }}
              >
                <div style={{
                  maxWidth: isSystem ? '100%' : '70%',
                  padding: isSystem ? '10px 16px' : '10px 16px',
                  borderRadius: isSystem ? '8px' : isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: isSystem ? Colors.surfaceContainerHigh : isOwn ? Colors.primary : Colors.surfaceContainerHighest,
                  color: isSystem ? Colors.onSurfaceVariant : isOwn ? Colors.onPrimary : Colors.onSurface,
                  alignSelf: isSystem ? 'center' : isOwn ? 'flex-end' : 'flex-start',
                  textAlign: isSystem ? 'center' : 'left',
                  fontSize: isSystem ? '13px' : '15px',
                  fontStyle: isSystem ? 'italic' : 'normal',
                }}>
                  {msg.content}
                  {msg.translated && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${isOwn ? 'rgba(255,255,255,0.2)' : Colors.outlineVariant}`, fontSize: '13px', opacity: 0.85 }}>
                      <span style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '2px' }}>
                        Translated to {translateLang}:
                      </span>
                      {msg.translated}
                    </div>
                  )}
                </div>
                {!isSystem && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: Colors.outline }}>
                      {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!msg.translated && msg.content && (
                      <button
                        onClick={() => handleTranslate(msg.id, msg.content!)}
                        disabled={msg.translating}
                        style={{ background: 'none', border: 'none', color: Colors.outline, cursor: 'pointer', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <span className="material-icons" style={{ fontSize: '14px' }}>{msg.translating ? 'sync' : 'translate'}</span>
                        {msg.translating ? '…' : `→ ${translateLang}`}
                      </button>
                    )}
                    {msg.translated && (
                      <button
                        onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, translated: undefined } : m))}
                        style={{ background: 'none', border: 'none', color: Colors.outline, cursor: 'pointer', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}
                      >
                        Hide
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {room.is_active ? (
        <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', borderTop: `1px solid ${Colors.outlineVariant}`, backgroundColor: Colors.surfaceContainerLow }}>
          <input
            type="text"
            style={{ flex: 1, padding: '12px 16px', backgroundColor: Colors.surfaceContainerHigh, border: `1px solid ${Colors.outlineVariant}`, borderRadius: '24px', color: Colors.onSurface, fontSize: '15px', outline: 'none', fontFamily: 'inherit' }}
            placeholder="Type a message…"
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            disabled={sending}
          />
          <Button onClick={sendMessage} loading={sending} disabled={!messageText.trim()}>
            <span className="material-icons" style={{ fontSize: '20px' }}>send</span>
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 24px', borderTop: `1px solid ${Colors.outlineVariant}`, backgroundColor: Colors.surfaceContainerLow }}>
          <p style={{ color: Colors.onSurfaceVariant, fontSize: '14px' }}>This chat has been closed.</p>
        </div>
      )}
    </div>
  )
}
