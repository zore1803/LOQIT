import { useMemo, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import RNPickerSelect from 'react-native-picker-select'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GradientButton } from '../../components/ui/GradientButton'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { isValidIMEI, registerDevice } from '../../hooks/useDevices'

const MAKE_OPTIONS = ['Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Other'] as const
const indiaStatesByCode = require('india-state-list/states.json') as Record<string, string>
const INDIA_STATE_OPTIONS = Object.entries(indiaStatesByCode)
  .map(([key, value]) => {
    if (key.length === 2 && value.length > 2) {
      return { label: value.trim(), value: key }
    }

    if (value.length === 2 && key.length > 2) {
      return { label: key.trim(), value }
    }

    return null
  })
  .filter((item): item is { label: string; value: string } => item !== null)
  .sort((a, b) => a.label.localeCompare(b.label))

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function AddDeviceScreen() {
  const router = useRouter()

  const [make, setMake] = useState<(typeof MAKE_OPTIONS)[number] | ''>('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [color, setColor] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [purchaseDate, setPurchaseDate] = useState<Date | null>(null)

  const [showMakeModal, setShowMakeModal] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // IMEI validation removed as per pure BLE model

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false)
    }

    if (selectedDate) {
      setPurchaseDate(selectedDate)
    }
  }

  const submit = async () => {
    if (!make || !model.trim() || !serialNumber.trim()) {
      setError('Make, model and serial number are required.')
      return
    }

    if (!stateCode) {
      setError('State is required.')
      return
    }

    // IMEI validation removed

    setSubmitting(true)
    setError(null)

    try {
      const device = await registerDevice({
        state: stateCode,
        make,
        model,
        imei_primary: `BLE-${serialNumber}`, // Internal placeholder for legacy DB compatibility
        imei_secondary: null,
        serial_number: serialNumber,
        color: color || null,
        purchase_date: purchaseDate ? formatDate(purchaseDate) : null,
      })

      // Link this physical device to the digital record
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('loqit_my_active_device_id', device.id);

      router.replace({
        pathname: '/device/confirmation',
        params: { deviceId: device.id },
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to register device.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Register Device</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Make</Text>
        <Pressable style={styles.inputLike} onPress={() => setShowMakeModal(true)}>
          <Text style={[styles.inputLikeText, !make && styles.placeholderText]}>{make || 'Select brand'}</Text>
          <MaterialIcons name="expand-more" size={20} color={Colors.onSurfaceVariant} />
        </Pressable>

        <Text style={styles.label}>Model</Text>
        <TextInput
          style={styles.input}
          value={model}
          onChangeText={setModel}
          placeholder="Enter model"
          placeholderTextColor={Colors.outline}
        />

        {/* IMEI fields removed */}

        <Text style={styles.label}>Serial Number</Text>
        <TextInput
          style={styles.input}
          value={serialNumber}
          onChangeText={setSerialNumber}
          placeholder="Enter serial number"
          placeholderTextColor={Colors.outline}
        />

        <Text style={styles.label}>Color</Text>
        <TextInput
          style={styles.input}
          value={color}
          onChangeText={setColor}
          placeholder="Color (optional)"
          placeholderTextColor={Colors.outline}
        />

        <Text style={styles.label}>State</Text>
        <RNPickerSelect
          value={stateCode || null}
          onValueChange={(value) => setStateCode(typeof value === 'string' ? value : '')}
          items={INDIA_STATE_OPTIONS}
          placeholder={{ label: 'Select state', value: null, color: Colors.outline }}
          useNativeAndroidPickerStyle={false}
          Icon={() => <MaterialIcons name="expand-more" size={20} color={Colors.onSurfaceVariant} />}
          style={pickerSelectStyles}
        />

        <Text style={styles.label}>Purchase Date</Text>
        <Pressable style={styles.inputLike} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.inputLikeText, !purchaseDate && styles.placeholderText]}>
            {purchaseDate ? formatDate(purchaseDate) : 'Select date'}
          </Text>
          <MaterialIcons name="calendar-today" size={18} color={Colors.onSurfaceVariant} />
        </Pressable>

        {showDatePicker ? (
          <DateTimePicker
            value={purchaseDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <GradientButton title="Register Device" onPress={() => void submit()} loading={submitting} />
      </ScrollView>

      <Modal visible={showMakeModal} transparent animationType="fade" onRequestClose={() => setShowMakeModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Make</Text>
            {MAKE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={styles.modalItem}
                onPress={() => {
                  setMake(option)
                  setShowMakeModal(false)
                }}
              >
                <Text style={styles.modalItemText}>{option}</Text>
                {make === option ? (
                  <MaterialIcons name="check" size={18} color={Colors.primary} />
                ) : null}
              </Pressable>
            ))}
            <Pressable onPress={() => setShowMakeModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    height: 64,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  headerTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 20,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 8,
  },
  label: {
    marginTop: 8,
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  inputLike: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLikeText: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
  },
  placeholderText: {
    color: Colors.outline,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  validationInput: {
    flex: 1,
  },
  errorText: {
    color: Colors.error,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    marginTop: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
    marginBottom: 6,
  },
  modalItem: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: Colors.surfaceContainerHighest,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemText: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
  },
  modalCancel: {
    textAlign: 'center',
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    marginTop: 10,
  },
})

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingRight: 36,
  },
  inputAndroid: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingRight: 36,
  },
  iconContainer: {
    top: 16,
    right: 12,
  },
  placeholder: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
  },
})
