import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorState } from '../../components/ui/ErrorState'
import { Header } from '../../components/ui/Header'
import { Skeleton } from '../../components/ui/Skeleton'
import { Toast } from '../../components/ui/Toast'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { getFinderRooms, upsertFinderRoom } from '../../services/finderRooms'
import { useTheme } from '../../hooks/useTheme'

type RoomItem = { id: string; deviceId: string; isActive: boolean; createdAt: string; ownerId: string; role: 'owner' | 'finder'; finderToken?: string; make: string; model: string; imeiTail: string; status: string; lastMessage: string; lastSentAt: string; unreadCount: number }

export default function ChatListScreen() {
  const router = useRouter(); const { user } = useAuth(); const { colors } = useTheme()
  const params = useLocalSearchParams()
  const { deviceId, initialMsg } = params as { deviceId?: string; initialMsg?: string }
  const [rooms, setRooms] = useState<RoomItem[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [toast, setToast] = useState('')

  const fetchRooms = useCallback(async () => {
    if (!user?.id) return; setLoading(true); setError(null)
    try {
      const [finderEntries, ownerResponse] = await Promise.all([getFinderRooms(), db.from('chat_rooms').select('*, devices(make, model, imei_primary, status)').eq('owner_id', user.id).order('created_at', { ascending: false })])
      const merged = (ownerResponse.data as any[] || []).map(r => ({ ...r, role: 'owner' as const }))
      const nextRooms = merged.map(r => ({ id: r.id, deviceId: r.device_id, ownerId: r.owner_id, isActive: r.is_active, createdAt: r.created_at, role: r.role, finderToken: '', make: r.devices?.make || 'Unknown', model: r.devices?.model || 'Device', imeiTail: (r.devices?.imei_primary || '----').slice(-4), status: r.devices?.status || 'registered', lastMessage: 'Tap to chat securely.', lastSentAt: r.created_at, unreadCount: 0 }))
      setRooms(nextRooms)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { void fetchRooms() }, [fetchRooms])

  // AUTO-INITIATOR: If we came from the scanner with a deviceId
  useEffect(() => {
    if (!deviceId || !user?.id || loading) return;

    const initRoom = async () => {
      console.log(`[Chat-Init] 🚀 Attempting to start chat for device: ${deviceId}`);
      setLoading(true);
      try {
        // 1. Check if room already exists
        const { data: existing, error: existErr } = await db
          .from('chat_rooms')
          .select('id')
          .eq('device_id', deviceId)
          .eq('finder_id', user.id)
          .maybeSingle();

        if (existErr) console.warn('[Chat-Init] Existing room check error:', existErr);

        if (existing) {
          console.log('[Chat-Init] 🟢 Existing room found. Redirecting...');
          router.replace({ pathname: '/chat/[roomId]', params: { roomId: existing.id } });
          return;
        }

        // 2. Get Device Owner
        console.log('[Chat-Init] 🔍 Identifying device owner...');
        const { data: device, error: devErr } = await db
          .from('devices')
          .select('owner_id')
          .eq('id', deviceId)
          .maybeSingle();

        if (devErr || !device) {
          console.error('[Chat-Init] ❌ Device owner lookup failed:', devErr);
          throw new Error('Could not find the owner of this device.');
        }

        // 3. Create Anonymous Room (Token based, no finder_id in DB)
        console.log(`[Chat-Init] 🛠️ Creating new room for device ${deviceId} and owner ${device.owner_id}`);
        const { data: newRoom, error: createErr } = await db
          .from('chat_rooms')
          .insert({
            device_id: deviceId,
            owner_id: device.owner_id,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createErr) {
          console.error('[Chat-Init] ❌ Room creation failed (Supabase):', createErr);
          throw createErr;
        }

        // 4. Generate and save Local Finder Token
        const finderToken = `finder-${Math.random().toString(36).slice(2, 11)}`;
        await upsertFinderRoom({
          roomId: newRoom.id,
          deviceId: deviceId,
          finderToken: finderToken
        });

        console.log('[Chat-Init] ✅ Room created & Token saved! ID:', newRoom.id);


        // 4. Send initial greeting
        if (initialMsg) {
          const { error: msgErr } = await db.from('chat_messages').insert({
            room_id: newRoom.id,
            sender_id: user.id,
            content: initialMsg,
            created_at: new Date().toISOString()
          });
          if (msgErr) console.warn('[Chat-Init] Initial message failed (non-fatal):', msgErr);
        }

        router.replace({ pathname: '/chat/[roomId]', params: { roomId: newRoom.id, finderToken: finderToken } });
      } catch (e: any) {
        setToast(`Error: ${e.message}`);
        console.error('[Chat-Init] 💥 Critical Failure:', e);
      } finally {
        setLoading(false);
      }
    };

    void initRoom();
  }, [deviceId, user, router])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header title="Anonymous Chat" rightIcon="forum" />
      <Toast visible={!!toast} message={toast} type="info" onHide={() => setToast('')} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.privacyBanner, { backgroundColor: `${colors.secondary}1A`, borderColor: `${colors.secondary}50` }]}>
          <MaterialIcons name="security" size={18} color={colors.secondary} />
          <Text style={[styles.privacyText, { color: colors.secondary }]}>Identity is hidden. Only secure handles are used between finder and owner.</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.metaTitle, { color: colors.onSurface }]}>Active rooms: {rooms.filter(r => r.isActive).length}</Text>
          <Pressable onPress={() => { void fetchRooms(); setToast('Refreshed') }}><Text style={{ color: colors.primary, fontFamily: FontFamily.bodyMedium, fontSize: 13 }}>Refresh</Text></Pressable>
        </View>

        {loading && <View style={{ gap: 10 }}><Skeleton height={80} borderRadius={16} /><Skeleton height={80} borderRadius={16} /></View>}
        {!loading && !rooms.length && (
          <View style={[styles.emptyWrap, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}1A` }]}><MaterialIcons name="chat-bubble-outline" size={26} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No chats yet</Text>
            <Text style={[styles.emptyBody, { color: colors.onSurfaceVariant }]}>Use Scanner to contact a nearby owner.</Text>
          </View>
        )}

        {rooms.map(room => (
          <Pressable key={room.id} style={[styles.roomCard, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]} onPress={() => router.push({ pathname: '/chat/[roomId]', params: { roomId: room.id, finderToken: room.finderToken || '' } })}>
            <View style={styles.roomTop}>
              <View style={[styles.roomIconWrap, { backgroundColor: `${colors.primary}1A` }]}><MaterialIcons name={room.role === 'owner' ? 'manage-accounts' : 'person-search'} size={17} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.roomTitle, { color: colors.onSurface }]}>{`${room.make} ${room.model}`}</Text><Text style={[styles.roomSub, { color: colors.outline }]}>{`IMEI •••• ${room.imeiTail}`}</Text></View>
              <Text style={[styles.timeText, { color: colors.outline }]}>Active</Text>
            </View>
            <View style={styles.roomBottom}>
              <Text style={[styles.previewText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{room.lastMessage}</Text>
              {!room.isActive && <View style={[styles.closedPill, { backgroundColor: `${colors.error}1A`, borderColor: `${colors.error}40` }]}><Text style={{ color: colors.error, fontSize: 10 }}>Closed</Text></View>}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 118, gap: 12 },
  privacyBanner: { borderRadius: 14, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  privacyText: { flex: 1, fontFamily: FontFamily.bodyRegular, fontSize: 12, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  metaTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  roomCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roomIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roomTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  roomSub: { marginTop: 2, fontFamily: FontFamily.monoMedium, fontSize: 10 },
  timeText: { fontFamily: FontFamily.monoMedium, fontSize: 10 },
  roomBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewText: { flex: 1, fontFamily: FontFamily.bodyRegular, fontSize: 12, lineHeight: 17 },
  closedPill: { height: 20, borderRadius: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emptyWrap: { marginTop: 16, borderRadius: 18, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 16 },
  emptyBody: { fontFamily: FontFamily.bodyRegular, fontSize: 13, lineHeight: 18, textAlign: 'center' }
})
