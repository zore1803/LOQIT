import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import { FontFamily } from '../../constants/typography'
import { GradientButton } from '../../components/ui/GradientButton'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'

export default function SignInScreen() {
  const router = useRouter(); const { signIn, signInWithGoogle } = useAuth(); const { colors } = useTheme()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [showPassword, setShowPassword] = useState(false); const [submitting, setSubmitting] = useState(false); const [errorMessage, setErrorMessage] = useState('')
  const passwordRef = useRef<TextInput | null>(null)

  const onSubmit = async () => {
    if (!email || !password) { setErrorMessage('Enter email and password'); return }
    setSubmitting(true); setErrorMessage('')
    const { error } = await signIn(email.trim(), password); setSubmitting(false)
    if (error) { setErrorMessage(error.message); return }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable style={[styles.backBtn, { backgroundColor: colors.surfaceContainerLow }]} onPress={() => router.navigate('/(auth)/onboarding')}>
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          </Pressable>

          <View style={styles.hero}>
            <LinearGradient colors={[colors.primary, colors.accent]} style={styles.heroIcon}><MaterialIcons name="shield" size={34} color="#fff" /></LinearGradient>
            <Text style={[styles.title, { color: colors.onSurface }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Sign in to secure your devices</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>EMAIL</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
                <MaterialIcons name="email" size={18} color={colors.outline} />
                <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={colors.outline} keyboardType="email-address" style={[styles.input, { color: colors.onSurface }]} />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>PASSWORD</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
                <MaterialIcons name="vpn-key" size={18} color={colors.outline} />
                <TextInput ref={passwordRef} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.outline} secureTextEntry={!showPassword} style={[styles.input, { color: colors.onSurface }]} />
                <Pressable onPress={() => setShowPassword(c => !c)}><MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.onSurfaceVariant} /></Pressable>
              </View>
            </View>

            {errorMessage ? <View style={[styles.errorBanner, { backgroundColor: `${colors.error}1A` }]}><MaterialIcons name="error-outline" size={16} color={colors.error} /><Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{errorMessage}</Text></View> : null}
            <GradientButton title={submitting ? 'Signing in...' : 'Sign In'} loading={submitting} onPress={onSubmit} />
            
            <View style={styles.divider}><View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} /><Text style={{ color: colors.outline, fontSize: 10 }}>OR</Text><View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} /></View>
            
            <Pressable style={[styles.googleBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]} onPress={() => signInWithGoogle()}>
              <MaterialIcons name="g-mobiledata" size={26} color={colors.onSurface} />
              <Text style={[styles.googleText, { color: colors.onSurface }]}>Google Account</Text>
            </Pressable>
          </View>

          <Pressable style={styles.footerRow} onPress={() => router.navigate('/(auth)/sign-up')}>
            <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Don't have an account? </Text>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Create Account</Text>
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
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 8 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: FontFamily.headingBold, fontSize: 28, textAlign: 'center' },
  subtitle: { fontFamily: FontFamily.bodyRegular, fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 20, padding: 20, gap: 16, borderWidth: 1 },
  field: { gap: 8 },
  label: { fontFamily: FontFamily.bodyMedium, fontSize: 11, letterSpacing: 1 },
  inputRow: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: FontFamily.bodyRegular, fontSize: 16, paddingVertical: 0 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  googleBtn: { height: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleText: { fontFamily: FontFamily.bodyMedium, fontSize: 15 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontFamily: FontFamily.bodyRegular, fontSize: 14 },
  footerLink: { fontFamily: FontFamily.bodyMedium, fontSize: 14 }
})
