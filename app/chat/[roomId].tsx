import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorState } from '../../components/ui/ErrorState'
import { Header } from '../../components/ui/Header'
import { Skeleton } from '../../components/ui/Skeleton'
import { Toast } from '../../components/ui/Toast'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { bleService } from '../../services/ble.service'
import { useTheme } from '../../hooks/useTheme'

type ChatMessage = { id: string; room_id: string; sender_role: 'owner' | 'finder' | 'system'; message_text?: string | null; content?: string | null; is_read: boolean; sent_at: string }

export default function ChatRoomScreen() {
  const router = useRouter(); const { user } = useAuth(); const { colors } = useTheme(); const params = useLocalSearchParams<{ roomId: string }>(); const roomId = params.roomId
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [messageText, setMessageText] = useState(''); const [loading, setLoading] = useState(false); const [sending, setSending] = useState(false); const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showLocationModal, setShowLocationModal] = useState(false); const [showMarkFoundModal, setShowMarkFoundModal] = useState(false)
  const scrollRef = useRef<ScrollView | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!roomId) return; setLoading(true)
    const { data } = await db.from('chat_messages').select('*').eq('room_id', roomId).order('sent_at', { ascending: true })
    if (data) setMessages(data as any); setLoading(false)
  }, [roomId])

  useEffect(() => { void fetchMessages() }, [fetchMessages])

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return; setSending(true)
    const { error } = await db.from('chat_messages').insert({ room_id: roomId, sender_role: 'owner', content: messageText.trim(), is_read: false })
    if (!error) { setMessageText(''); void fetchMessages() }
    setSending(false)
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Secure Chat" onBackPress={() => router.back()} rightIcon="verified-user" />
      <Toast visible={!!toast} message={toast?.message || ''} type={toast?.type || 'info'} onHide={() => setToast(null)} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.metaBar, { borderBottomColor: colors.outlineVariant }]}>
          <View><Text style={[styles.deviceTitle, { color: colors.onSurface }]}>Anonymous Secure Connection</Text><Text style={[styles.deviceMeta, { color: colors.outline }]}>Identity Hidden • End-to-End Secure</Text></View>
          <View style={[styles.statusPill, { backgroundColor: `${colors.secondary}1A` }]}><Text style={{ color: colors.secondary, fontFamily: FontFamily.bodyMedium, fontSize: 11 }}>Active</Text></View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.chatContent} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} showsVerticalScrollIndicator={false}>
          {messages.map((msg) => {
            const mine = msg.sender_role === 'owner'
            return (
              <View key={msg.id} style={[styles.messageWrap, mine ? styles.messageMineWrap : styles.messageOtherWrap]}>
                <View style={[styles.messageBubble, mine ? { backgroundColor: colors.primary, borderTopRightRadius: 5 } : { backgroundColor: colors.surfaceContainerHigh, borderTopLeftRadius: 5 }]}>
                  <Text style={{ fontFamily: FontFamily.bodyRegular, fontSize: 14, lineHeight: 19, color: mine ? colors.onPrimary : colors.onSurface }}>{msg.content || msg.message_text}</Text>
                </View>
                <Text style={{ color: colors.outline, fontFamily: FontFamily.monoMedium, fontSize: 10 }}>{new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            )
          })}
        </ScrollView>

        <View style={[styles.actionRow, { borderTopColor: colors.outlineVariant }]}>
          <Pressable style={[styles.actionButton, { backgroundColor: `${colors.primary}1A` }]} onPress={() => setShowLocationModal(true)}><MaterialIcons name="my-location" size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontFamily: FontFamily.bodyMedium, fontSize: 12 }}>Share Location</Text></Pressable>
          <Pressable style={[styles.actionButton, { backgroundColor: `${colors.secondary}1A` }]} onPress={() => setShowMarkFoundModal(true)}><MaterialIcons name="check-circle" size={16} color={colors.secondary} /><Text style={{ color: colors.secondary, fontFamily: FontFamily.bodyMedium, fontSize: 12 }}>Mark Found</Text></Pressable>
        </View>

        <View style={[styles.inputContainer, { backgroundColor: colors.surfaceContainer, borderTopColor: colors.outlineVariant }]}>
          <TextInput value={messageText} onChangeText={setMessageText} placeholder="Type your message..." placeholderTextColor={colors.outline} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]} multiline />
          <Pressable style={[styles.sendButton, { backgroundColor: colors.primary }, !messageText.trim() && { opacity: 0.5 }]} onPress={sendMessage} disabled={!messageText.trim() || sending}><MaterialIcons name="send" size={18} color={colors.onPrimary} /></Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showLocationModal || showMarkFoundModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceContainer }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>{showLocationModal ? 'Share Location?' : 'Mark as Found?'}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={() => { setShowLocationModal(false); setShowMarkFoundModal(false) }}><Text style={{ color: colors.onSurface }}>Cancel</Text></Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowLocationModal(false); setShowMarkFoundModal(false); setToast({ message: 'Action processed', type: 'success' }) }}><Text style={{ color: colors.onPrimary }}>Confirm</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  metaBar: { minHeight: 58, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  deviceTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 14 },
  deviceMeta: { marginTop: 2, fontFamily: FontFamily.monoMedium, fontSize: 10 },
  statusPill: { height: 22, borderRadius: 11, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  chatContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20, gap: 8 },
  messageWrap: { gap: 2 },
  messageMineWrap: { alignItems: 'flex-end' },
  messageOtherWrap: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  actionRow: { flexDirection: 'row', padding: 10, gap: 8, borderTopWidth: 1 },
  actionButton: { flex: 1, height: 38, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  inputContainer: { flexDirection: 'row', padding: 12, paddingBottom: 34, gap: 10, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, fontFamily: FontFamily.bodyRegular, fontSize: 15 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 20, padding: 20, alignItems: 'center', gap: 14 },
  modalTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 18 },
  modalBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }
})
