import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { startLostTracking, stopLostTracking } from '../services/lostTrackingTask'

export type DeviceStatus = 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'

export type DeviceRecord = {
  id: string
  owner_id: string
  state: string | null
  make: string
  model: string
  imei_primary: string
  imei_secondary: string | null
  serial_number: string
  loqit_key: string | null
  ble_device_uuid: string | null
  color: string | null
  purchase_date: string | null
  status: DeviceStatus
  is_ble_active: boolean
  last_seen_at: string | null
  last_seen_lat: number | null
  last_seen_lng: number | null
  created_at: string
  updated_at: string
}

export type BeaconLog = {
  id: string
  latitude: number
  longitude: number
  accuracy_meters: number | null
  rssi: number | null
  reported_at: string
}

type RegisterDeviceInput = {
  state: string
  make: string
  model: string
  imei_primary: string
  imei_secondary?: string | null
  serial_number: string
  color?: string | null
  purchase_date?: string | null
}

type LostReportInput = {
  incident_description: string
  last_known_address: string
  police_complaint_number?: string
  reward_amount?: number | null
  last_known_lat?: number | null
  last_known_lng?: number | null
}

type UseDevicesResult = {
  devices: DeviceRecord[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

type UseDeviceResult = {
  device: (DeviceRecord & { beacon_logs?: BeaconLog[] }) | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// IMEI validation removed as per pure BLE model

export function useDevices() {
  const { user, loading: authLoading } = useAuth()
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [loading, setLoading] = useState(true) // Start as loading
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    // If auth is still loading, stay in loading state and wait
    if (authLoading) return

    if (!user?.id) {
      setDevices([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setDevices([])
      setLoading(false)
      return
    }

    if (data) {
      setDevices(data as DeviceRecord[])
    }

    setLoading(false)
  }, [user?.id, authLoading])

  useEffect(() => {
    void fetchDevices()
  }, [fetchDevices])

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
  } satisfies UseDevicesResult
}

export function useDevice(id: string): UseDeviceResult {
  const { user, loading: authLoading } = useAuth()
  const [device, setDevice] = useState<(DeviceRecord & { beacon_logs?: BeaconLog[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevice = useCallback(async () => {
    if (authLoading) return

    if (!id || !user?.id) {
      setDevice(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('devices')
      .select('*, beacon_logs(id, latitude, longitude, accuracy_meters, rssi, reported_at)')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (error) {
      setError(error.message)
      setDevice(null)
      setLoading(false)
      return
    }

    setDevice((data as DeviceRecord & { beacon_logs?: BeaconLog[] }) ?? null)
    setLoading(false)
  }, [id, user?.id, authLoading])

  useEffect(() => {
    void fetchDevice()
  }, [fetchDevice])

  return { device, loading, error, refetch: fetchDevice }
}

export async function registerDevice(input: RegisterDeviceInput): Promise<DeviceRecord> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user?.id) {
    throw new Error(authError?.message ?? 'You must be signed in to register a device.')
  }

  const userId = authData.user.id

  // Ensure a profiles row exists for this user.
  // The signup trigger should create it, but if it failed silently we
  // need the row or the devices FK constraint will reject the insert.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: authData.user.user_metadata?.full_name ?? '',
        phone_number: authData.user.user_metadata?.phone_number ?? null,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (profileError) {
    throw new Error(`Profile sync failed: ${profileError.message}`)
  }

  // IMEI validation gates removed
  const imeiPrimary = input.imei_primary || `SN-${input.serial_number}`
  const imeiSecondary = input.imei_secondary || null

  const payload = {
    owner_id: userId,
    state: input.state.trim().toUpperCase(),
    make: input.make.trim(),
    model: input.model.trim(),
    imei_primary: imeiPrimary,
    imei_secondary: imeiSecondary,
    serial_number: input.serial_number.trim(),
    color: input.color?.trim() || null,
    purchase_date: input.purchase_date || null,
    status: 'registered' as DeviceStatus,
  }

  const { data, error } = await supabase.from('devices').insert(payload).select('*').single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to register device.')
  }

  return data as DeviceRecord
}

export async function reportLost(deviceId: string, reportData: LostReportInput): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user?.id) {
    throw new Error(authError?.message ?? 'You must be signed in to report lost device.')
  }

  const ownerId = authData.user.id

  const { error: updateError } = await supabase
    .from('devices')
    .update({
      status: 'lost',
      is_ble_active: true,
      last_seen_lat: reportData.last_known_lat ?? null,
      last_seen_lng: reportData.last_known_lng ?? null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId)
    .eq('owner_id', ownerId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const { error: reportError } = await supabase.from('lost_reports').insert({
    device_id: deviceId,
    owner_id: ownerId,
    incident_description: reportData.incident_description,
    last_known_address: reportData.last_known_address,
    police_complaint_number: reportData.police_complaint_number || null,
    reward_amount: reportData.reward_amount ?? null,
    last_known_lat: reportData.last_known_lat ?? null,
    last_known_lng: reportData.last_known_lng ?? null,
    is_active: true,
  })

  if (reportError) {
    throw new Error(reportError.message)
  }

  // Start background periodic tracking
  void startLostTracking()
}

export async function markFound(deviceId: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user?.id) {
    throw new Error(authError?.message ?? 'You must be signed in to update device status.')
  }

  const { error } = await supabase
    .from('devices')
    .update({
      status: 'recovered',
      is_ble_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId)
    .eq('owner_id', authData.user.id)

  if (error) {
    throw new Error(error.message)
  }

  // Check if any other devices are still lost before stopping the global background task
  const { data: lostDevices } = await supabase
    .from('devices')
    .select('id')
    .eq('owner_id', authData.user.id)
    .eq('status', 'lost')

  if (!lostDevices || lostDevices.length === 0) {
    void stopLostTracking()
  }
}