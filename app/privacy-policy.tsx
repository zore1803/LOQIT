import { ScrollView, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Header } from '../components/ui/Header'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'

export default function PrivacyPolicyScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Privacy Policy" onBackPress={() => router.back()} rightIcon="policy" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: March 2024</Text>

        <Section title="Introduction">
          LOQIT ("we", "our", or "us") is committed to protecting your privacy. This Privacy 
          Policy explains how we collect, use, and safeguard your information when you use our 
          mobile application.
        </Section>

        <Section title="Information We Collect">
          <BulletPoint text="Account Information: Name, email address, phone number" />
          <BulletPoint text="Device Information: hardware serial number, make, model" />
          <BulletPoint text="Location Data: GPS coordinates when scanning or reporting" />
          <BulletPoint text="Aadhaar Data: Encrypted hash for identity verification (never stored in plain text)" />
          <BulletPoint text="Bluetooth Data: BLE beacon signals for device proximity detection" />
        </Section>

        <Section title="How We Use Your Information">
          <BulletPoint text="To register and track your devices" />
          <BulletPoint text="To enable device recovery through BLE scanning" />
          <BulletPoint text="To facilitate anonymous communication between finders and owners" />
          <BulletPoint text="To send notifications about your devices" />
          <BulletPoint text="To verify your identity for security purposes" />
        </Section>

        <Section title="Data Storage & Security">
          Your data is stored securely using Supabase with encryption at rest and in transit. 
          We implement row-level security policies to ensure you can only access your own data. 
          Aadhaar information is stored as a one-way hash and cannot be reversed.
        </Section>

        <Section title="Location Data">
          Location data is collected only when you actively use scanning features or share your 
          location in chat. Background location access is used solely for lost device detection 
          and can be disabled in Settings.
        </Section>

        <Section title="Data Sharing">
          We do not sell your personal information. Location data may be shared with device 
          owners only when you voluntarily report finding their device. Chat messages are 
          end-to-end encrypted between participants.
        </Section>

        <Section title="Your Rights">
          <BulletPoint text="Access your personal data at any time" />
          <BulletPoint text="Request deletion of your account and data" />
          <BulletPoint text="Disable location sharing in app settings" />
          <BulletPoint text="Opt out of notifications" />
        </Section>

        <Section title="Contact Us">
          For privacy concerns or data requests, contact us at:{'\n'}
          support@loqit.app
        </Section>

        <View style={styles.disclaimer}>
          <MaterialIcons name="warning" size={20} color={Colors.tertiary} />
          <Text style={styles.disclaimerText}>
            By using LOQIT, you agree to this Privacy Policy. We may update this policy 
            periodically and will notify you of significant changes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof children === 'string' ? (
        <Text style={styles.sectionText}>{children}</Text>
      ) : (
        <View style={styles.bulletList}>{children}</View>
      )}
    </View>
  )
}

function BulletPoint({ text }: { text: string }) {
  return (
    <View style={styles.bulletItem}>
      <View style={styles.bullet} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  lastUpdated: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    marginBottom: 8,
  },
  sectionText: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  bulletList: {
    gap: 6,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  disclaimer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,185,95,0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,185,95,0.3)',
  },
  disclaimerText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
})
