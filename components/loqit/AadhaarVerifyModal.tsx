import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as Crypto from 'expo-crypto'

import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { GradientButton } from '../ui/GradientButton'
import { useTheme } from '../../hooks/useTheme'

type AadhaarVerifyModalProps = {
  visible: boolean
  onClose: () => void
}

export function AadhaarVerifyModal({ visible, onClose }: AadhaarVerifyModalProps) {
  const { refreshProfile, user } = useAuth(); const { colors } = useTheme()
  const [aadhaarNumber, setAadhaarNumber] = useState(''); const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState(false); const [aadhaarMessage, setAadhaarMessage] = useState<string | null>(null); const [savingAadhaar, setSavingAadhaar] = useState(false)

  const resetAndClose = () => { setAadhaarNumber(''); setOtp(''); setOtpStep(false); setAadhaarMessage(null); onClose() }

  const verifyAadhaar = async () => {
    const digits = aadhaarNumber.replace(/\D/g, '')
    if (digits.length !== 12 || (otpStep && otp !== '123456')) { setAadhaarMessage('Invalid input'); return }
    if (!otpStep) { setAadhaarMessage('Dev OTP: 123456'); setOtpStep(true); return }
    setSavingAadhaar(true); setAadhaarMessage(null)
    try {
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digits)
      const { error } = await db.from('profiles').update({ aadhaar_verified: true, aadhaar_hash: hash, updated_at: new Date().toISOString() }).eq('id', user?.id || '')
      if (error) { setAadhaarMessage(error.message); return }
      await refreshProfile?.(); resetAndClose()
    } finally { setSavingAadhaar(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainer, borderTopColor: colors.outlineVariant }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Aadhaar Verification</Text>
          <TextInput style={[styles.modalInput, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, color: colors.onSurface }]} keyboardType="number-pad" placeholder="12-digit Aadhaar" placeholderTextColor={colors.outline} value={aadhaarNumber} onChangeText={v => setAadhaarNumber(v.replace(/\D/g, '').slice(0, 12))} />
          {otpStep && <TextInput style={[styles.modalInput, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, color: colors.onSurface }]} keyboardType="number-pad" placeholder="OTP (123456)" placeholderTextColor={colors.outline} value={otp} onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))} />}
          {aadhaarMessage && <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{aadhaarMessage}</Text>}
          <GradientButton title={otpStep ? 'Verify Aadhaar' : 'Send OTP'} onPress={verifyAadhaar} loading={savingAadhaar} />
          <Pressable onPress={resetAndClose}><Text style={[styles.modalCancel, { color: colors.onSurfaceVariant }]}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, gap: 14, borderTopWidth: 1 },
  modalHandle: { width: 48, height: 5, borderRadius: 4, alignSelf: 'center' },
  modalTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 20 },
  modalInput: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontFamily: FontFamily.monoMedium, fontSize: 15 },
  modalCancel: { textAlign: 'center', fontFamily: FontFamily.bodyMedium, fontSize: 14, marginTop: 4 }
})
