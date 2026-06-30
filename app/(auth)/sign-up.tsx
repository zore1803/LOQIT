import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'

import { FontFamily } from '../../constants/typography'
import { GradientButton } from '../../components/ui/GradientButton'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'

function Field({ label, icon, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry, rightAdornment, inputRef, returnKeyType = 'next', blurOnSubmit = false, onSubmitEditing, prefix, colors }: any) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
        {prefix ? <View style={[styles.prefix, { backgroundColor: colors.surfaceContainerHigh }]}><Text style={{ color: colors.onSurfaceVariant, fontFamily: FontFamily.bodyMedium, fontSize: 14 }}>{prefix}</Text></View> : <MaterialIcons name={icon} size={18} color={colors.outline} />}
        <TextInput ref={inputRef} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.outline} keyboardType={keyboardType} secureTextEntry={secureTextEntry} style={[styles.input, { color: colors.onSurface }]} returnKeyType={returnKeyType} blurOnSubmit={blurOnSubmit} onSubmitEditing={onSubmitEditing} />
        {rightAdornment}
      </View>
    </View>
  )
}

export default function SignUpScreen() {
  const router = useRouter(); const { signUp } = useAuth(); const { colors } = useTheme()
  const [fullName, setFullName] = useState(''); const [phoneNumber, setPhoneNumber] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [aadhaarEnabled, setAadhaarEnabled] = useState(false); const [aadhaar, setAadhaar] = useState(''); const [showPassword, setShowPassword] = useState(false); const [submitting, setSubmitting] = useState(false); const [errorMessage, setErrorMessage] = useState('')
  const phoneRef = useRef<TextInput | null>(null); const emailRef = useRef<TextInput | null>(null); const passwordRef = useRef<TextInput | null>(null); const aadhaarRef = useRef<TextInput | null>(null)

  const onSubmit = async () => {
    if (!fullName || !email || !password || !phoneNumber) { setErrorMessage('Fill all fields'); return }

    // Client-side validation: Phone Number
    const phoneClean = phoneNumber.replace(/[^0-9]/g, '')
    if (phoneClean.length !== 10) {
      setErrorMessage('Phone number must be exactly 10 digits.')
      return
    }

    // Client-side validation: Password Strength
    if (password.length < 8) { setErrorMessage('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(password)) { setErrorMessage('Password must contain an uppercase letter.'); return }
    if (!/[a-z]/.test(password)) { setErrorMessage('Password must contain a lowercase letter.'); return }
    if (!/[0-9]/.test(password)) { setErrorMessage('Password must contain a number.'); return }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) { setErrorMessage('Password must contain a special symbol.'); return }

    setSubmitting(true); setErrorMessage('')
    const { error } = await signUp({ email: email.trim(), password, fullName: fullName.trim(), phoneNumber: `+91${phoneClean}` })
    if (error) { setSubmitting(false); setErrorMessage(error.message); return }
    setSubmitting(false)
    router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable style={[styles.backBtn, { backgroundColor: colors.surfaceContainerLow }]} onPress={() => router.navigate('/(auth)/onboarding')}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          </Pressable>

          <View style={styles.hero}>
            <LinearGradient colors={[colors.secondary, colors.accent]} style={styles.heroIcon}><MaterialIcons name="person-add" size={32} color="#fff" /></LinearGradient>
            <Text style={[styles.title, { color: colors.onSurface }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Join LOQIT and protect your devices</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <Field label="FULL NAME" icon="person" value={fullName} onChangeText={setFullName} placeholder="Name" onSubmitEditing={() => phoneRef.current?.focus()} colors={colors} />
            <Field label="PHONE NUMBER" icon="phone" value={phoneNumber} onChangeText={setPhoneNumber} placeholder="00000 00000" keyboardType="phone-pad" inputRef={phoneRef} prefix="+91" onSubmitEditing={() => emailRef.current?.focus()} colors={colors} />
            <Field label="EMAIL" icon="email" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" inputRef={emailRef} onSubmitEditing={() => passwordRef.current?.focus()} colors={colors} />
            <Field label="PASSWORD" icon="vpn-key" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} inputRef={passwordRef} colors={colors} rightAdornment={<Pressable onPress={() => setShowPassword(c => !c)}><MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.onSurfaceVariant} /></Pressable>} />

            <View style={styles.toggleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.toggleIconWrap, { backgroundColor: `${colors.secondary}1A` }]}><MaterialIcons name="verified-user" size={16} color={colors.secondary} /></View>
                <Text style={{ color: colors.onSurface, fontFamily: FontFamily.bodyMedium, fontSize: 14 }}>Aadhaar Verification</Text>
              </View>
              <Switch value={aadhaarEnabled} onValueChange={setAadhaarEnabled} trackColor={{ false: colors.surfaceContainerHigh, true: `${colors.primary}66` }} thumbColor={aadhaarEnabled ? colors.primary : colors.onSurfaceVariant} />
            </View>

            {errorMessage ? <View style={[styles.errorBanner, { backgroundColor: `${colors.error}1A` }]}><MaterialIcons name="error-outline" size={16} color={colors.error} /><Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{errorMessage}</Text></View> : null}
            <GradientButton title={submitting ? 'Creating...' : 'Create Account'} loading={submitting} onPress={onSubmit} />
          </View>

          <Pressable style={styles.footerRow} onPress={() => router.navigate('/(auth)/sign-in')}>
            <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Already have an account? </Text>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, gap: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  hero: { alignItems: 'center', paddingTop: 4, paddingBottom: 4, gap: 8 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: FontFamily.headingBold, fontSize: 28, textAlign: 'center' },
  subtitle: { fontFamily: FontFamily.bodyRegular, fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 20, padding: 20, gap: 14, borderWidth: 1 },
  field: { gap: 8 },
  label: { fontFamily: FontFamily.bodyMedium, fontSize: 11, letterSpacing: 1 },
  inputRow: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: FontFamily.bodyRegular, fontSize: 16, paddingVertical: 0 },
  prefix: { minWidth: 42, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  toggleIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontFamily: FontFamily.bodyRegular, fontSize: 14 },
  footerLink: { fontFamily: FontFamily.bodyMedium, fontSize: 14 }
})
