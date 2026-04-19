import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra as any) || {}
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || 'https://qnyukwxgrvrfwhrsaepj.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFueXVrd3hncnZyZndocnNhZXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTkyNTUsImV4cCI6MjA5MTQ3NTI1NX0.82yHHZCoWOeui_zrltOqx-onq6s5G_j0emhhZobM4oE'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[LOQIT] Warning: Working with empty Supabase credentials.')
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)