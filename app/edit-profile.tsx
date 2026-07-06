import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Header } from '../components/ui/Header'
import { Toast } from '../components/ui/Toast'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'

export default function EditProfileScreen() {
  const router = useRouter()
  const { profile, user, refreshProfile } = useAuth()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone_number ?? '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const saveProfile = async () => {
    if (!user?.id) {
      setToast({ message: 'You must be signed in.', type: 'error' })
      return
    }

    if (!fullName.trim()) {
      setToast({ message: 'Full name is required.', type: 'error' })
      return
    }

    setSaving(true)
    try {
      const { error } = await db
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      await refreshProfile?.()
      setToast({ message: 'Profile updated successfully.', type: 'success' })
      
      setTimeout(() => {
        router.back()
      }, 1000)
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Unable to update profile.',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Edit Profile" onBackPress={() => router.back()} rightIcon="person" />

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.outline}
              autoCapitalize="words"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputDisabled}>
              <Text style={styles.inputDisabledText}>{user?.email ?? 'No email'}</Text>
              <MaterialIcons name="lock" size={16} color={Colors.outline} />
            </View>
            <Text style={styles.hint}>Email cannot be changed from the app.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              placeholderTextColor={Colors.outline}
              keyboardType="phone-pad"
              editable={!saving}
            />
          </View>

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => void saveProfile()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color={Colors.onPrimary} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
  },
  inputDisabled: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputDisabledText: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
  },
  hint: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11,
    marginLeft: 4,
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.onPrimary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
  },
})
