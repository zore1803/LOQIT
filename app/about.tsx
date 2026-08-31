import { ScrollView, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Header } from '../components/ui/Header'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'

export default function AboutScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container}>
      <Header title="About LOQIT" onBackPress={() => router.back()} rightIcon="info" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoSection}>
          <LinearGradient
            colors={[Colors.primary, Colors.inversePrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoCircle}
          >
            <MaterialIcons name="shield" size={48} color={Colors.onPrimary} />
          </LinearGradient>
          <Text style={styles.appName}>LOQIT</Text>
          <Text style={styles.appSubtitle}>Secure Phone Ownership & Recovery System</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What is LOQIT?</Text>
          <Text style={styles.sectionText}>
            LOQIT is a Bluetooth-based lost device tracking application designed to help users 
            register, protect, and recover their personal devices. Using BLE (Bluetooth Low Energy) 
            technology, LOQIT creates a community-powered network for device recovery.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          <View style={styles.featureList}>
            <FeatureItem icon="smartphone" text="Register and track your devices" />
            <FeatureItem icon="bluetooth" text="BLE-based proximity scanning" />
            <FeatureItem icon="location-on" text="Real-time location updates" />
            <FeatureItem icon="chat" text="Anonymous finder-owner chat" />
            <FeatureItem icon="notifications" text="Instant lost device alerts" />
            <FeatureItem icon="verified-user" text="Aadhaar identity verification" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <Text style={styles.sectionText}>
            1. Register your devices with IMEI and serial numbers{'\n'}
            2. If a device is lost, mark it as lost in the app{'\n'}
            3. Other LOQIT users scan for nearby lost devices{'\n'}
            4. When found, the finder can chat anonymously with you{'\n'}
            5. Coordinate safe recovery of your device
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technology</Text>
          <Text style={styles.sectionText}>
            Built with React Native & Expo for cross-platform support. A MongoDB-backed 
            LOQIT API handles accounts and real-time communication. BLE advertising and scanning 
            provide proximity detection without requiring internet connectivity.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ for device security</Text>
          <Text style={styles.copyright}>© 2024 LOQIT. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function FeatureItem({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View style={styles.featureItem}>
      <MaterialIcons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.featureText}>{text}</Text>
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
    paddingTop: 20,
    paddingBottom: 40,
    gap: 24,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    color: Colors.primary,
    fontFamily: FontFamily.headingBold,
    fontSize: 32,
    letterSpacing: 2,
  },
  appSubtitle: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  version: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 12,
    marginTop: 8,
  },
  section: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    marginBottom: 10,
  },
  sectionText: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  featureList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    gap: 4,
  },
  footerText: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
  },
  copyright: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
  },
})
