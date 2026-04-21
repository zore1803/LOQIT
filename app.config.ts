import type { ExpoConfig } from 'expo/config'
import { withAndroidManifest, ConfigPlugin, AndroidConfig } from '@expo/config-plugins'

const googleMapsApiKey = 'AIzaSyBz6jmHel66wfzwB3zqjAmD73ADuv1T0Ek'

// Custom plugin to inject foregroundServiceType for Android 14+ compatibility
const withForegroundServiceType: ConfigPlugin = (config) => {
  return withAndroidManifest(config, async (modConfig) => {
    const manifest = modConfig.modResults
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)
    
    const services = application.service || []
    for (const service of services) {
      const serviceName = service.$?.['android:name']
      if (serviceName === 'com.voximplant.foregroundservice.VIForegroundService') {
        service.$['android:foregroundServiceType'] = 'connectedDevice|location'
      }
    }
    
    return modConfig
  })
}

const config: ExpoConfig = {
  name: 'LOQIT',
  slug: 'loqit',
  scheme: 'loqit',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',

  extra: {
    eas: {
      projectId: 'd631b2e5-564c-42cb-aa6d-0cd7dd71e09a',
    },
    supabaseUrl: 'https://qnyukwxgrvrfwhrsaepj.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFueXVrd3hncnZyZndocnNhZXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTkyNTUsImV4cCI6MjA5MTQ3NTI1NX0.82yHHZCoWOeui_zrltOqx-onq6s5G_j0emhhZobM4oE',
    n8nSendUrl: 'https://zore1803.app.n8n.cloud/webhook/send-verification',
    n8nVerifyUrl: 'https://zore1803.app.n8n.cloud/webhook/verify-otp',
  },

  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    bundleIdentifier: 'com.loqit.app',
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'LOQIT uses location while scanning to report nearby lost devices securely.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'LOQIT may use location in the background to keep lost device tracking accurate.',
    },
  },
  android: {
    package: 'com.loqit.app',
    versionCode: 3,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: googleMapsApiKey
      ? {
          googleMaps: {
            apiKey: googleMapsApiKey,
          },
        }
      : undefined,
    permissions: [
      'BLUETOOTH',
      'BLUETOOTH_ADMIN',
      'BLUETOOTH_SCAN',
      'BLUETOOTH_ADVERTISE',
      'BLUETOOTH_CONNECT',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_CONNECTED_DEVICE',
      'POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    '@react-native-community/datetimepicker',
    'expo-background-fetch',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow LOQIT to access location for continuous lost-device tracking.',
        locationWhenInUsePermission:
          'Allow LOQIT to access location while scanning for nearby devices.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        foregroundService: {
          notificationTitle: "LOQIT Active Tracking",
          notificationBody: "Your lost device is being tracked in the background.",
          notificationColor: "#3D8EFF"
        }
      },
    ],
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: true,
        modes: ['central'],
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
        },
      },
    ],
    [
      'react-native-maps',
      {
        googleMapsApiKey: googleMapsApiKey,
      },
    ],
    'expo-web-browser',
  ],
  experiments: {
    typedRoutes: true,
  }
}

// Apply custom plugins
export default withForegroundServiceType(config)
