import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, NativeModules, Alert, Platform, TextInput, Modal } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

import { useTheme } from '../../hooks/useTheme'
import { Header } from '../../components/ui/Header'
import { Card } from '../../components/ui/Card'
import { FontFamily } from '../../constants/typography'
import { setDevicePasskey, hasPasskeySet } from '../../components/loqit/LostDeviceLock'

const { LOQITSecurity } = NativeModules

export default function SecuritySetupScreen() {
    const router = useRouter()
    const { colors } = useTheme()
    const [isAdminActive, setIsAdminActive] = useState(false)
    const [isOverlayActive, setIsOverlayActive] = useState(false)
    const [isLockdownRunning, setIsLockdownRunning] = useState(false)
    const [passkeySet, setPasskeySet] = useState(false)
    const [showPasskeyModal, setShowPasskeyModal] = useState(false)
    const [newPin, setNewPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [pinHint, setPinHint] = useState('')
    const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter')
    const [myDeviceId, setMyDeviceId] = useState<string | null>(null)

    useEffect(() => {
        const loadStatus = async () => {
            try {
                const myId = await AsyncStorage.getItem('loqit_my_active_device_id')
                if (!myId) return
                setMyDeviceId(myId)

                const localAdmin = await AsyncStorage.getItem(`lockdown_admin_${myId}`)
                const localPower = await AsyncStorage.getItem(`lockdown_power_${myId}`)

                if (localAdmin !== null) setIsAdminActive(localAdmin === 'true')
                if (localPower !== null) setIsOverlayActive(localPower === 'true')

                const pkSet = await hasPasskeySet(myId)
                setPasskeySet(pkSet)

                const { data } = await supabase.from('devices').select('hardware_lockdown, power_protection').eq('id', myId).maybeSingle()
                if (data) {
                    if (localAdmin === null) setIsAdminActive(!!data.hardware_lockdown)
                    if (localPower === null) setIsOverlayActive(!!data.power_protection)
                    if (data.hardware_lockdown || data.power_protection) setIsLockdownRunning(true)
                }
            } catch (e) {
                console.warn('[Lockdown-Init] DB fetch failed, using local data.')
            }
        }
        loadStatus()
    }, [])

    const handleEnableAdmin = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert('Not Supported', 'Device Administrator features are only available on Android.')
            return
        }
        setIsAdminActive(true)
        try {
            if (LOQITSecurity?.activateDeviceAdmin) await LOQITSecurity.activateDeviceAdmin()
            let targetId = myDeviceId
            if (!targetId) targetId = await AsyncStorage.getItem('loqit_my_active_device_id')
            if (targetId) {
                await AsyncStorage.setItem(`lockdown_admin_${targetId}`, 'true')
                const { error } = await supabase.from('devices').update({ hardware_lockdown: true }).eq('id', targetId)
                if (error) console.log('[Lockdown-Sync] DB skipped.')
                else console.log('[Lockdown-Sync] Saved to cloud.')
            }
        } catch (e) { console.error('[Lockdown] Activation failed:', e) }
    }

    const handleEnableOverlay = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert('Not Supported', 'Power Menu blocking is only available on Android.')
            return
        }
        setIsOverlayActive(true)
        try {
            if (LOQITSecurity?.requestOverlayPermission) {
                const granted = await LOQITSecurity.requestOverlayPermission()
                if (!granted) {
                    setIsOverlayActive(false)
                    Alert.alert('Permission Required', "Please enable 'Appear on top' for LOQIT.")
                    return
                }
            }
            let targetId = myDeviceId
            if (!targetId) targetId = await AsyncStorage.getItem('loqit_my_active_device_id')
            if (targetId) {
                await AsyncStorage.setItem(`lockdown_power_${targetId}`, 'true')
                const { error } = await supabase.from('devices').update({ power_protection: true }).eq('id', targetId)
                if (error) console.log('[Lockdown-Sync] DB skipped.')
            }
        } catch (e) { console.error('[Lockdown] Overlay failed:', e); setIsOverlayActive(false) }
    }

    const handleStartLockdown = async () => {
        if (!isAdminActive || !isOverlayActive) {
            Alert.alert('Setup Required', 'Please enable both Hardware Lockdown and Power Protection first.')
            return
        }
        if (!passkeySet) {
            Alert.alert('Passkey Required', 'Please set your LOQIT passkey first so only you can unlock your device if it is lost.')
            setShowPasskeyModal(true)
            return
        }
        try {
            await LOQITSecurity.startLockdownService()
            setIsLockdownRunning(true)
            Alert.alert('Lockdown Active', 'Professional Anti-Theft protection is now running in the background.')
        } catch (e) { console.error(e) }
    }

    const handleSavePasskey = async () => {
        if (pinStep === 'enter') {
            if (newPin.length < 4) { Alert.alert('Too Short', 'Please enter at least 4 digits.'); return }
            setPinStep('confirm')
            return
        }
        if (confirmPin !== newPin) {
            Alert.alert('Mismatch', 'PINs do not match. Please try again.')
            setConfirmPin(''); setPinStep('enter'); setNewPin('')
            return
        }
        const deviceId = myDeviceId || await AsyncStorage.getItem('loqit_my_active_device_id')
        if (!deviceId) { Alert.alert('Error', 'No device paired. Please pair a device first.'); return }
        await setDevicePasskey(newPin, pinHint, deviceId)
        setPasskeySet(true)
        setShowPasskeyModal(false)
        setNewPin(''); setConfirmPin(''); setPinHint(''); setPinStep('enter')
        Alert.alert('Passkey Set ✓', 'Your LOQIT passkey is saved. This PIN will lock your screen if the device is ever reported as lost.')
    }

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            <Header title="Hard Lockdown" onBack={() => router.back()} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.hero}>
                    <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}15` }]}>
                        <MaterialIcons name="security" size={48} color={colors.primary} />
                    </View>
                    <Text style={[styles.heroTitle, { color: colors.onSurface }]}>High-Security Mode</Text>
                    <Text style={[styles.heroSub, { color: colors.onSurfaceVariant }]}>
                        Prevent unauthorized device tampering and factory resets even if the device is stolen.
                    </Text>
                </View>

                {/* ── PASSKEY ── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.outline }]}>LOQIT PASSKEY</Text>
                    <Card style={styles.featureCard}>
                        <View style={styles.featureInfo}>
                            <View style={[styles.iconBox, { backgroundColor: passkeySet ? `${colors.secondary}15` : `${colors.error}15` }]}>
                                <MaterialIcons name="pin" size={24} color={passkeySet ? colors.secondary : colors.error} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.onSurface }]}>Lock Screen PIN</Text>
                                <Text style={[styles.featureDesc, { color: colors.onSurfaceVariant }]}>
                                    {passkeySet
                                        ? 'PIN is set. Only you can unlock the device if it is marked as lost.'
                                        : 'Set a PIN that activates when your device is reported as lost. Thieves cannot bypass it.'}
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => { setPinStep('enter'); setNewPin(''); setConfirmPin(''); setShowPasskeyModal(true) }}
                            style={[styles.smallBtn, { backgroundColor: passkeySet ? `${colors.secondary}20` : `${colors.primary}20` }]}
                        >
                            <Text style={{ color: passkeySet ? colors.secondary : colors.primary, fontSize: 13, fontFamily: FontFamily.headingBold }}>
                                {passkeySet ? 'Change' : 'Set PIN'}
                            </Text>
                        </Pressable>
                    </Card>
                </View>

                {/* ── CORE PROTECTION ── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.outline }]}>CORE PROTECTION</Text>

                    <Card style={styles.featureCard}>
                        <View style={styles.featureInfo}>
                            <View style={[styles.iconBox, { backgroundColor: `${colors.secondary}15` }]}>
                                <MaterialIcons name="phonelink-lock" size={24} color={colors.secondary} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.onSurface }]}>Hardware Lockdown</Text>
                                <Text style={[styles.featureDesc, { color: colors.onSurfaceVariant }]}>
                                    Prevents factory reset from settings or recovery mode without your LOQIT credentials.
                                </Text>
                            </View>
                        </View>
                        <Switch value={isAdminActive} onValueChange={handleEnableAdmin} trackColor={{ false: colors.outlineVariant, true: colors.secondary }} />
                    </Card>

                    <Card style={styles.featureCard}>
                        <View style={styles.featureInfo}>
                            <View style={[styles.iconBox, { backgroundColor: `${colors.tertiary}15` }]}>
                                <MaterialIcons name="power-settings-new" size={24} color={colors.tertiary} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.onSurface }]}>Power Protection</Text>
                                <Text style={[styles.featureDesc, { color: colors.onSurfaceVariant }]}>
                                    Requests your passkey before allowing the device to be switched off or restarted.
                                </Text>
                            </View>
                        </View>
                        <Switch value={isOverlayActive} onValueChange={handleEnableOverlay} trackColor={{ false: colors.outlineVariant, true: colors.tertiary }} />
                    </Card>
                </View>

                {/* ── FACTORY RESET PROTECTION ── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.outline }]}>FACTORY RESET PROTECTION</Text>
                    <Card style={[styles.featureCard, { opacity: isAdminActive ? 1 : 0.5 }]}>
                        <View style={styles.featureInfo}>
                            <View style={[styles.iconBox, { backgroundColor: isAdminActive ? `${colors.error}15` : `${colors.outline}15` }]}>
                                <MaterialIcons name="no-sim" size={24} color={isAdminActive ? colors.error : colors.outline} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.onSurface }]}>Factory Reset</Text>
                                <Text style={[styles.featureDesc, { color: colors.onSurfaceVariant }]}>
                                    {isAdminActive
                                        ? 'Blocked — Device Admin is active. A factory reset requires your Google account credentials linked to this device.'
                                        : 'Enable Hardware Lockdown above to block factory resets by thieves.'}
                                </Text>
                            </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: isAdminActive ? `${colors.error}18` : `${colors.outline}18` }]}>
                            <MaterialIcons name={isAdminActive ? 'block' : 'lock-open'} size={16} color={isAdminActive ? colors.error : colors.outline} />
                            <Text style={{ color: isAdminActive ? colors.error : colors.outline, fontSize: 11, fontFamily: FontFamily.headingBold, marginLeft: 4 }}>
                                {isAdminActive ? 'LOCKED' : 'OPEN'}
                            </Text>
                        </View>
                    </Card>
                </View>

                <View style={styles.warningBox}>
                    <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                    <Text style={[styles.warningText, { color: colors.onSurface }]}>
                        Enabling these features requires standard Android Device Administrator permissions. This is required for deep-level security.
                    </Text>
                </View>

                <Pressable
                    onPress={handleStartLockdown}
                    disabled={isLockdownRunning}
                    style={({ pressed }) => [styles.mainBtn, { backgroundColor: isLockdownRunning ? colors.secondary : colors.primary, opacity: pressed ? 0.9 : 1 }]}
                >
                    <MaterialIcons name={isLockdownRunning ? 'verified' : 'flash-on'} size={20} color="#fff" />
                    <Text style={styles.mainBtnText}>{isLockdownRunning ? 'Lockdown Operational' : 'Activate Full Protection'}</Text>
                </Pressable>
            </ScrollView>

            {/* ── SET PASSKEY MODAL ── */}
            <Modal visible={showPasskeyModal} transparent animationType="slide">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainer }]}>
                        <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                            {pinStep === 'enter' ? 'Set LOQIT PIN' : 'Confirm your PIN'}
                        </Text>
                        <Text style={[styles.modalSub, { color: colors.onSurfaceVariant }]}>
                            {pinStep === 'enter'
                                ? 'Enter a 4–8 digit PIN. This is the only way to unlock your device if it is reported as lost.'
                                : 'Enter the same PIN again to confirm.'}
                        </Text>

                        <TextInput
                            style={[styles.pinInput, { borderColor: colors.primary, color: colors.onSurface, backgroundColor: colors.surfaceContainerHigh }]}
                            value={pinStep === 'enter' ? newPin : confirmPin}
                            onChangeText={pinStep === 'enter' ? setNewPin : setConfirmPin}
                            keyboardType="numeric"
                            secureTextEntry
                            maxLength={8}
                            placeholder="● ● ● ●"
                            placeholderTextColor={colors.outline}
                            autoFocus
                        />

                        {pinStep === 'enter' && (
                            <>
                                <Text style={[styles.hintLabel, { color: colors.onSurfaceVariant }]}>PIN hint (optional)</Text>
                                <TextInput
                                    style={[styles.hintInput, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerHigh }]}
                                    value={pinHint}
                                    onChangeText={setPinHint}
                                    placeholder="e.g. My first pet's name"
                                    placeholderTextColor={colors.outline}
                                    maxLength={40}
                                />
                            </>
                        )}

                        <View style={styles.modalBtns}>
                            <Pressable
                                onPress={() => { setShowPasskeyModal(false); setNewPin(''); setConfirmPin(''); setPinStep('enter') }}
                                style={[styles.modalBtn, { backgroundColor: colors.surfaceContainerHigh }]}
                            >
                                <Text style={{ color: colors.onSurfaceVariant, fontFamily: FontFamily.headingBold }}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handleSavePasskey} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                                <Text style={{ color: '#fff', fontFamily: FontFamily.headingBold }}>
                                    {pinStep === 'enter' ? 'Next →' : 'Save PIN'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    content: { padding: 16 },
    hero: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
    heroIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    heroTitle: { fontSize: 24, fontFamily: FontFamily.headingBold, marginBottom: 8 },
    heroSub: { fontSize: 15, fontFamily: FontFamily.bodyRegular, textAlign: 'center', lineHeight: 22 },
    section: { gap: 12, marginBottom: 24 },
    sectionLabel: { fontSize: 12, fontFamily: FontFamily.headingBold, letterSpacing: 1, marginBottom: 4 },
    featureCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    featureInfo: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 16 },
    iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    featureText: { flex: 1, paddingRight: 8 },
    featureTitle: { fontSize: 16, fontFamily: FontFamily.headingSemiBold, marginBottom: 4 },
    featureDesc: { fontSize: 13, fontFamily: FontFamily.bodyRegular, lineHeight: 18 },
    smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    warningBox: { flexDirection: 'row', padding: 16, borderRadius: 12, backgroundColor: '#e3f2fd', gap: 12, marginBottom: 24 },
    warningText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: FontFamily.bodyRegular },
    mainBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 40 },
    mainBtnText: { color: '#fff', fontSize: 16, fontFamily: FontFamily.headingBold },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalSheet: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontFamily: FontFamily.headingBold, marginBottom: 8 },
    modalSub: { fontSize: 14, fontFamily: FontFamily.bodyRegular, lineHeight: 20, marginBottom: 20 },
    pinInput: { height: 56, borderRadius: 14, borderWidth: 2, paddingHorizontal: 20, fontSize: 22, fontFamily: FontFamily.monoMedium, textAlign: 'center', letterSpacing: 8, marginBottom: 16 },
    hintLabel: { fontSize: 13, fontFamily: FontFamily.bodyMedium, marginBottom: 8 },
    hintInput: { height: 48, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 14, fontFamily: FontFamily.bodyRegular, marginBottom: 20 },
    modalBtns: { flexDirection: 'row', gap: 12 },
    modalBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
