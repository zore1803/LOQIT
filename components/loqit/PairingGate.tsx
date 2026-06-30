import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { GradientButton } from '../ui/GradientButton';
import { StructuredLoader } from '../ui/StructuredLoader';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PairingGateProps {
  handsetIdentifier: string;
  onPaired: (deviceId: string) => void;
  children: React.ReactNode;
}

export function PairingGate({ handsetIdentifier, onPaired, children }: PairingGateProps) {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
  const [userDevices, setUserDevices] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    if (!handsetIdentifier) {
      setLoading(false);
      return;
    }

    async function checkPairing() {
      try {
        const userId = session?.user?.id
        if (!userId) return
        setLoading(true);
        // Check if this handset is already linked
        const { data: linkedDevice, error } = await supabase
          .from('devices')
          .select('id')
          .eq('installation_id', handsetIdentifier)
          .eq('owner_id', userId)
          .maybeSingle();

        if (linkedDevice) {
          setPairedDeviceId(linkedDevice.id);
          await AsyncStorage.setItem('loqit_my_active_device_id', linkedDevice.id);
          onPaired(linkedDevice.id);
        } else {
          // If not linked, see if they have devices to link
          const { data: devices } = await supabase
            .from('devices')
            .select('*')
            .eq('owner_id', userId);
          
          if (devices && devices.length > 0) {
            setUserDevices(devices);
            // Don't show modal immediately on the very first boot if they just came from Google
            const wasJustLoggedIn = await AsyncStorage.getItem('loqit_just_logged_in');
            if (wasJustLoggedIn !== 'true') {
                setShowModal(true);
            } else {
                await AsyncStorage.removeItem('loqit_just_logged_in');
            }
          }
        }
      } catch (err) {
        console.error('[PairingGate] Error checked pairing:', err);
      } finally {
        setLoading(false);
      }
    }

    checkPairing();
  }, [session, handsetIdentifier]);

  const [error, setError] = useState<string | null>(null);

  const pairDevice = async (deviceId: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`[PairingGate] Attempting to pair device ${deviceId} with handset ${handsetIdentifier}`);

      const { data: updateData, error: updateError } = await supabase
        .from('devices')
        .update({ installation_id: handsetIdentifier })
        .eq('id', deviceId)
        .select();

      if (updateError) {
        console.error('[PairingGate] Update error:', updateError);
        throw new Error(updateError.message || 'Failed to update device record on server.');
      }

      if (!updateData || updateData.length === 0) {
        throw new Error('Device record not found or permission denied.');
      }

      console.log('[PairingGate] Pairing successful!');
      setPairedDeviceId(deviceId);
      await AsyncStorage.setItem('loqit_my_active_device_id', deviceId);
      setShowModal(false);
      onPaired(deviceId);
    } catch (err: any) {
      const msg = err.message || 'Unknown pairing error';
      console.error('[PairingGate] Error pairing device:', msg);
      setError(msg);
      Alert.alert('Pairing Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !showModal && !pairedDeviceId) {
    return (
      <StructuredLoader
        colors={Colors}
        variant="pairing"
        message="Preparing device pairing..."
      />
    );
  }

  return (
    <>
      {children}

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="phonelink-setup" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Identify this phone</Text>
              <Text style={styles.subtitle}>
                To enable active tracking and protection, tell us which of your registered devices this phone is.
              </Text>
            </View>

            <FlatList
              data={userDevices}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable 
                  style={styles.deviceItem}
                  onPress={() => pairDevice(item.id)}
                >
                  <View style={styles.deviceIcon}>
                    <MaterialIcons name="phone-android" size={24} color={Colors.onSurfaceVariant} />
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{item.make} {item.model}</Text>
                    <Text style={styles.deviceDetail}>SN: {item.serial_number}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={Colors.outline} />
                </Pressable>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No registered devices found.</Text>
                </View>
              )}
            />

            <View style={styles.actions}>
              <GradientButton 
                title="Register New Device" 
                onPress={() => {
                  setShowModal(false);
                  // We can't easily navigate here without a router, 
                  // but we can let them see the tabs
                }}
              />
              <Pressable 
                style={styles.skipButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.skipText}>Link Later</Text>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Not seeing your device? Register it first in the Devices tab.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}1A`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.onSurface,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  list: {
    paddingHorizontal: 24,
    gap: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    color: Colors.onSurface,
  },
  deviceDetail: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.outline,
    marginTop: 2,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.outline,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.outline,
  },
  actions: {
    padding: 24,
    gap: 12,
  },
  skipButton: {
    padding: 12,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: Colors.primary,
  },
});
