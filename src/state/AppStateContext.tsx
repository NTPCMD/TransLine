import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useDriver } from './DriverContext';
import { useActiveAssignment } from './AssignmentContext';
import { getAssignedVehicleForCurrentUser } from '../lib/assignment';
import { getGpsFix } from '../lib/locationEvents';
import { networkMonitor } from '../lib/networkMonitor';
import { offlineQueue } from '../lib/offlineQueue';
import { startShift as rpcStartShift, endShift as rpcEndShift } from '../lib/shiftLifecycle';
import { uploadShiftPhoto } from '../lib/photoUpload';

export interface VehicleInfo {
  id: string | null;
  rego: string | null;
  make: string | null;
  model: string | null;
}

export interface ChecklistAnswer {
  id: string;
  label: string;
  status: 'pass' | 'fail' | null;
  note: string;
  critical: boolean;
  sectionTitle: string;
}

export interface AppState {
  isLoggedIn: boolean;
  declarationAccepted: boolean;
  assignedVehicle: VehicleInfo | null;
  vehicleId: string | null;
  vehicleRegistration: string | null;
  shiftStarted: boolean;
  checklistCompleted: boolean;
  checklistSubmitted: boolean;
  preStartChecklistAnswers: ChecklistAnswer[];
  odometerReading: string;
  odometerPhoto: string;
  startOdometerCapturedAt: string | null;
  startOdometerLat: number | null;
  startOdometerLng: number | null;
  startOdometerAccuracy: number | null;
  shiftStartTime: Date | null;
  isOnBreak: boolean;
  lastFueled?: string | null;
  breakStartedAt?: string | null;
  breakAccumulatedSeconds?: number;
  shiftNotes: string[];
  endShiftRubbishRemoved: 'yes' | 'no' | null;
  endShiftNotes: string;
  userId: string | null;
  driverRecordId: string | null;
  activeShiftId: string | null;
  activeShiftVehicleId?: string | null;
  activeShiftVehicleResolutionError?: string | null;
  queuedEventsCount: number;
  postShiftComplete: boolean;
}

interface AppStateContextValue {
  state: AppState;
  updateAppState: (updates: Partial<AppState>) => void;
  resetShift: () => void;
  clearSessionState: () => Promise<void>;
  refreshCurrentVehicle: () => Promise<void>;
  submitPreStartChecklist: (payload: {
    answers: ChecklistAnswer[];
    hasFailures: boolean;
    hasCriticalFailures: boolean;
    assignmentVehicleId?: string | null;
  }) => Promise<{ ok: boolean; shiftId?: string | null; error?: string; queued?: boolean }>;
  startShift: (payload?: {
    odometerReading: string;
    odometerPhoto: string;
    capturedAt?: string;
    location?: { lat: number; lng: number; accuracy: number | null };
    checklistAnswers?: ChecklistAnswer[];
    sourceScreen?: string;
  }) => Promise<{ shiftId: string | null; error?: string; queued?: boolean }>;
  endShift: (payload: {
    endOdometerValue: number;
    endOdometerPhoto: string;
    capturedAt: string;
    location: { lat: number; lng: number; accuracy: number | null };
  }) => Promise<{ ok: boolean; error?: string; queued?: boolean }>;
  createEvent: (
    eventType: string,
    metadata?: Record<string, unknown>,
    options?: { queueOnError?: boolean; locationOverride?: { latitude: number; longitude: number } },
    activeShiftIdOverride?: string | null
  ) => Promise<{ status: 'sent' | 'queued' | 'error'; error?: string }>;
  closeActiveBreak: (options?: { queueOnError?: boolean }) => Promise<{
    closed: boolean;
    durationSeconds: number;
    result?: { status: 'sent' | 'queued' | 'error'; error?: string };
  }>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

const EVENT_QUEUE_KEY = 'transline:queuedEvents';
const WRITE_QUEUE_KEY = 'transline:queuedWrites';
const OFFLINE_QUEUED_MESSAGE = 'Saved offline. Will sync automatically.';
const CRITICAL_EVENT_TYPES = new Set([
  'fuel_log',
  'driver_log',
  'break_start',
  'break_end',
  'odometer_start',
  'odometer_end',
  'shift_start',
  'shift_end',
  'location',
]);

type EventQueueItem = {
  id: string;
  event: {
    shift_id: string | null;
    event_type: string;
    latitude?: number | null;
    longitude?: number | null;
    metadata: Record<string, unknown>;
  };
};

const ALLOWED_RPC_NAMES = ['start_shift', 'end_shift', 'log_idle_event'] as const;
type AllowedRpcName = typeof ALLOWED_RPC_NAMES[number];

type RpcQueuedWrite = {
  id: string;
  type: 'rpc_call';
  name: AllowedRpcName;
  params: Record<string, unknown>;
};

type QueuedWrite = RpcQueuedWrite;

type ShiftEventOdometerRow = {
  id?: string;
  created_at: string;
  metadata: unknown;
};

const initialState: AppState = {
  isLoggedIn: false,
  declarationAccepted: false,
  assignedVehicle: null,
  vehicleId: null,
  vehicleRegistration: null,
  shiftStarted: false,
  checklistCompleted: false,
  checklistSubmitted: false,
  preStartChecklistAnswers: [],
  odometerReading: '',
  odometerPhoto: '',
  startOdometerCapturedAt: null,
  startOdometerLat: null,
  startOdometerLng: null,
  startOdometerAccuracy: null,
  shiftStartTime: null,
  isOnBreak: false,
  lastFueled: null,
  breakStartedAt: null,
  breakAccumulatedSeconds: 0,
  shiftNotes: [],
  endShiftRubbishRemoved: null,
  endShiftNotes: '',
  userId: null,
  driverRecordId: null,
  activeShiftId: null,
  activeShiftVehicleId: null,
  activeShiftVehicleResolutionError: null,
  queuedEventsCount: 0,
  postShiftComplete: false,
};

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const updateAppState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const resetShift = () => {
    setState(prev => ({
      ...initialState,
      isLoggedIn: prev.isLoggedIn,
      declarationAccepted: prev.declarationAccepted,
      userId: prev.userId,
      queuedEventsCount: prev.queuedEventsCount,
    }));
  };

  const clearSessionState = async () => {
    setState(prev => ({
      ...initialState,
      isLoggedIn: prev.isLoggedIn,
      declarationAccepted: prev.declarationAccepted,
      userId: prev.userId,
      driverRecordId: prev.driverRecordId,
      queuedEventsCount: prev.queuedEventsCount,
    }));
  };

  const refreshCurrentVehicle = useCallback(async () => {
    try {
      const { vehicle, error } = await getAssignedVehicleForCurrentUser();
      if (error) {
        console.warn('[Assignment] Refresh vehicle details failed:', error);
      }
      setState(prev => ({
        ...prev,
        vehicleId: vehicle?.id ?? null,
        assignedVehicle: vehicle
          ? {
              id: vehicle.id ?? null,
              rego: vehicle.rego ?? null,
              make: vehicle.make ?? null,
              model: vehicle.model ?? null,
            }
          : null,
        vehicleRegistration:
          vehicle?.registration ?? vehicle?.rego ?? vehicle?.plate_number ?? null,
      }));
    } catch (err) {
      console.warn('[Assignment] Refresh vehicle details error:', err);
    }
  }, []);

  const { authUserId, currentDriver } = useDriver();
  const { status: assignmentStatus, vehicle: assignedVehicle } = useActiveAssignment();

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((queue) => {
      setState(prev => ({ ...prev, queuedEventsCount: queue.length }));
    });
    return () => unsubscribe();
  }, []);

  // Sync assignment context into app state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      userId: authUserId,
      isLoggedIn: Boolean(authUserId),
      driverRecordId: currentDriver?.id ?? prev.driverRecordId,
      vehicleId:
        assignmentStatus === 'loading' ? prev.vehicleId : assignedVehicle?.id ?? null,
      assignedVehicle:
        assignmentStatus === 'loading'
          ? prev.assignedVehicle
          : assignedVehicle
            ? {
                id: assignedVehicle.id ?? null,
                rego: assignedVehicle.rego ?? null,
                make: assignedVehicle.make ?? null,
                model: assignedVehicle.model ?? null,
              }
            : null,
      vehicleRegistration:
        assignmentStatus === 'loading'
          ? prev.vehicleRegistration
          : assignedVehicle?.registration ?? assignedVehicle?.rego ?? assignedVehicle?.plate_number ?? null,
    }));
  }, [authUserId, currentDriver, assignmentStatus, assignedVehicle]);

  const loadQueuedEvents = async (): Promise<EventQueueItem[]> => {
    const stored = await AsyncStorage.getItem(EVENT_QUEUE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as EventQueueItem[];
    } catch {
      return [];
    }
  };

  const saveQueuedEvents = async (queue: EventQueueItem[]) => {
    await AsyncStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(queue));
  };

  const generateUuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  const resolveAuthUserId = async () => {
    if (state.userId) return state.userId;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      const uid = data?.user?.id ?? null;
      if (uid) setState(prev => ({ ...prev, userId: uid, isLoggedIn: true }));
      return uid;
    } catch {
      return null;
    }
  };

  // Resolve only via drivers.user_id; no fallback IDs.
  const resolveDriverRecordId = async (authUserId: string | null) => {
    if (!authUserId) {
      return { driverRecordId: null as string | null, error: 'User not available.' };
    }

    const lookup = await supabase
      .from('drivers')
      .select('id, user_id, full_name, status')
      .eq('user_id', authUserId)
      .single();

    if (lookup.error) {
      console.warn('[DriverResolve] Failed to resolve driver via user_id', {
        authUserId,
        message: lookup.error.message,
      });
      return { driverRecordId: null as string | null, error: lookup.error.message };
    }

    const driverRecordId = lookup.data?.id ?? null;
    if (!driverRecordId) {
      console.warn('[DriverResolve] No driver record found', { authUserId });
      return { driverRecordId: null as string | null, error: 'Driver profile not available.' };
    }

    if (state.driverRecordId !== driverRecordId) {
      setState(prev => ({ ...prev, driverRecordId }));
    }

    return { driverRecordId, error: null as string | null };
  };

  // profiles.id = auth.users.id (your schema)
  const resolveProfileId = async (authUserId: string | null) => {
    if (!authUserId) {
      return { profileId: null as string | null, error: 'User not available.' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle();

    if (error) {
      console.warn('[ProfileResolve] Failed to resolve profile', {
        authUserId,
        message: error.message,
      });
      return { profileId: null as string | null, error: error.message };
    }

    if (!data?.id) {
      console.warn('[ProfileResolve] No profile record found', { authUserId });
      return { profileId: null as string | null, error: 'Profile not available.' };
    }

    return { profileId: data.id, error: null as string | null };
  };

  const loadWriteQueue = async (): Promise<QueuedWrite[]> => {
    const stored = await AsyncStorage.getItem(WRITE_QUEUE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as QueuedWrite[];
    } catch {
      return [];
    }
  };

  const buildChecklistPayload = (answers: ChecklistAnswer[]) => {
    if (!answers.length) {
      return null;
    }

    return answers.reduce<Record<string, unknown>>((acc, answer) => {
      acc[answer.id] = {
        status: answer.status,
        note: answer.note,
        critical: answer.critical,
        label: answer.label,
        section: answer.sectionTitle,
      };
      return acc;
    }, {});
  };

  const normalizeShiftId = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    return null;
  };

  const parseOdometerKm = (metadata: unknown): number | null => {
    if (!metadata || typeof metadata !== 'object') return null;
    const record = metadata as Record<string, unknown>;
    if (record.unit !== 'km') return null;

    const rawValue = record.odometer_value;
    const value =
      typeof rawValue === 'number'
        ? rawValue
        : typeof rawValue === 'string'
          ? Number(rawValue)
          : NaN;

    if (!Number.isFinite(value)) return null;
    return value;
  };

  const getLatestVehicleOdometerKm = useCallback(async (vehicleId: string) => {
    const eventTypes = ['odometer_start', 'odometer_end'];

    const [metadataVehicleResult, shiftVehicleResult] = await Promise.all([
      supabase
        .from('shift_events')
        .select('id, created_at, metadata')
        .in('event_type', eventTypes)
        .eq('metadata->>vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('shift_events')
        .select('id, created_at, metadata, shifts!inner(vehicle_id)')
        .in('event_type', eventTypes)
        .eq('shifts.vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (metadataVehicleResult.error) {
      return { value: null as number | null, error: metadataVehicleResult.error.message };
    }

    if (shiftVehicleResult.error) {
      return { value: null as number | null, error: shiftVehicleResult.error.message };
    }

    const rows = [
      ...((metadataVehicleResult.data ?? []) as ShiftEventOdometerRow[]),
      ...((shiftVehicleResult.data ?? []) as ShiftEventOdometerRow[]),
    ];

    const deduped = new Map<string, ShiftEventOdometerRow>();
    for (const row of rows) {
      const key = row.id ?? `${row.created_at}:${JSON.stringify(row.metadata)}`;
      if (!deduped.has(key)) deduped.set(key, row);
    }

    const sorted = Array.from(deduped.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const row of sorted) {
      const parsed = parseOdometerKm(row.metadata);
      if (parsed !== null) {
        return { value: parsed, error: null as string | null };
      }
    }

    return { value: null as number | null, error: null as string | null };
  }, []);

  const saveWriteQueue = async (queue: QueuedWrite[]) => {
    await AsyncStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(queue));
  };

  const queueWrite = async (item: QueuedWrite) => {
    const queue = await loadWriteQueue();
    queue.push(item);
    await saveWriteQueue(queue);
  };

  const resolveLocation = async () => {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.status !== 'granted') return null;
    }
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  };

  const processQueueItem = async (item: EventQueueItem): Promise<boolean> => {
    const { error } = await supabase.from('shift_events').insert({
      shift_id: item.event.shift_id,
      event_type: item.event.event_type,
      latitude: item.event.latitude ?? null,
      longitude: item.event.longitude ?? null,
      metadata: item.event.metadata,
    });
    if (error) {
      console.error('Failed to insert queued shift_event', {
        eventType: item.event.event_type,
        shiftId: item.event.shift_id,
        message: error.message,
      });
      return false;
    }
    return true;
  };

  const processEventQueue = useCallback(async () => {
    const queue = await loadQueuedEvents();
    if (queue.length === 0) return;
    const remaining: EventQueueItem[] = [];
    for (const item of queue) {
      const success = await processQueueItem(item);
      if (!success) remaining.push(item);
    }
    await saveQueuedEvents(remaining);
  }, []);

  const processWriteQueue = useCallback(async () => {
    const queue = await loadWriteQueue();
    if (queue.length === 0) return;
    const isOnline = await networkMonitor.isOnline();
    if (!isOnline) return;

    const remaining: QueuedWrite[] = [];
    for (const item of queue) {
      try {
        if (item.type === 'rpc_call') {
          if (!(ALLOWED_RPC_NAMES as readonly string[]).includes(item.name)) {
            console.error('[processWriteQueue] Blocked disallowed RPC name:', item.name);
            continue;
          }
          const { error } = await supabase.rpc(item.name, item.params);
          if (error) throw error;
        }
      } catch (error) {
        remaining.push(item);
      }
    }
    await saveWriteQueue(remaining);
  }, []);

  useEffect(() => {
    if (state.driverRecordId) {
      processEventQueue();
      processWriteQueue();
    }
  }, [processEventQueue, processWriteQueue, state.driverRecordId]);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((isOnline) => {
      if (isOnline) {
        processEventQueue();
        processWriteQueue();
      }
    });
    return () => unsubscribe();
  }, [processEventQueue, processWriteQueue]);

  const createEvent = useCallback(
    async (
      eventType: string,
      metadata: Record<string, unknown> = {},
      options?: { queueOnError?: boolean; locationOverride?: { latitude: number; longitude: number } },
      activeShiftIdOverride?: string | null
    ) => {
      const requestedQueueOnError = options?.queueOnError ?? true;
      const mustQueueOnError = requestedQueueOnError || CRITICAL_EVENT_TYPES.has(eventType);
      const locationOverride = options?.locationOverride;
      const location = locationOverride
        ? {
            coords: {
              latitude: locationOverride.latitude,
              longitude: locationOverride.longitude,
              accuracy: null,
            },
          }
        : await resolveLocation();
      const driverId = state.driverRecordId;
      if (!driverId) {
        return { status: 'error' as const, error: 'Driver profile not available.' };
      }

      let normalizedMetadata: Record<string, unknown> = metadata;
      if (eventType === 'fuel_log') {
        const receiptPhotoPath =
          typeof metadata.receipt_photo_path === 'string' ? metadata.receipt_photo_path.trim() : '';

        if (!receiptPhotoPath || receiptPhotoPath.startsWith('data:')) {
          return {
            status: 'error' as const,
            error: 'Fuel receipt upload failed. Please retry and ensure a valid receipt path is saved.',
          };
        }

        const { receipt_urls: _ignoredReceiptUrls, ...rest } = metadata;
        normalizedMetadata = {
          ...rest,
          receipt_photo_path: receiptPhotoPath,
        };
      }

      console.log(`[Event] Creating event "${eventType}" with metadata`, { metadata: normalizedMetadata, location });
      const shiftEvent = {
        shift_id: activeShiftIdOverride || state.activeShiftId,
        event_type: eventType,
        latitude: location?.coords.latitude ?? null,
        longitude: location?.coords.longitude ?? null,
        metadata: normalizedMetadata,
      };

      const isOnline = await networkMonitor.isOnline();

      if (!isOnline) {
        if (mustQueueOnError) {
          await offlineQueue.addEvent(eventType, {
            shift_id: activeShiftIdOverride || state.activeShiftId || '',
            event_type: eventType,
            latitude: location?.coords.latitude ?? null,
            longitude: location?.coords.longitude ?? null,
            metadata: normalizedMetadata,
          });
          return { status: 'queued' as const, error: OFFLINE_QUEUED_MESSAGE };
        }
        return { status: 'error' as const, error: 'Device is offline' };
      }

      await processEventQueue();

      console.log(`[Event] Creating event "${eventType}"`, { shiftEvent });
      const { error } = await supabase.from('shift_events').insert(shiftEvent);
      console.log(`[Event] Insert result for "${eventType}"`, { error });
      if (error) {
        console.error('Failed to create shift_event', { eventType, shiftId: state.activeShiftId, message: error.message });
        if (mustQueueOnError) {
          await offlineQueue.addEvent(eventType, {
            shift_id: activeShiftIdOverride || state.activeShiftId || '',
            event_type: eventType,
            latitude: location?.coords.latitude ?? null,
            longitude: location?.coords.longitude ?? null,
            metadata: normalizedMetadata,
          });
          return { status: 'queued' as const, error: OFFLINE_QUEUED_MESSAGE };
        }
        return { status: 'error' as const, error: error.message };
      }

      return { status: 'sent' as const };
    },
    [processEventQueue, state.activeShiftId, state.driverRecordId, state.vehicleId]
  );

  const ensureActiveShift = useCallback(async (
    vehicleIdOverride?: string | null,
    startLat: number | null = null,
    startLng: number | null = null,
    checklistPayload?: Record<string, unknown> | null,
    sourceScreen?: string
  ) => {
    const resolvedUserId = await resolveAuthUserId();
    if (!resolvedUserId) return { shiftId: null, error: 'User not available.' };

    const driverResolution = await resolveDriverRecordId(resolvedUserId);
    const driverRecordId = driverResolution.driverRecordId;
    if (!driverRecordId) {
      return { shiftId: null, error: driverResolution.error ?? 'Driver profile not available.' };
    }

    const vehicleIdToUse = vehicleIdOverride ?? state.vehicleId;
    if (!vehicleIdToUse) {
      return { shiftId: null, error: 'No vehicle assigned. Refresh assignment to continue.' };
    }

    const isOnline = await networkMonitor.isOnline();

    if (state.activeShiftId) {
      if (isOnline) {
        const { data, error } = await supabase
          .from('shifts')
          .select('id, vehicle_id, driver_id')
          .eq('id', state.activeShiftId)
          .maybeSingle();
        if (!error && data) {
          return { shiftId: data.id, driverId: data.driver_id ?? driverRecordId, shiftVehicleId: data.vehicle_id ?? vehicleIdToUse };
        }
      }
      return { shiftId: state.activeShiftId, driverId: driverRecordId, shiftVehicleId: vehicleIdToUse };
    }

    // Look for existing active shift
    const { data: activeShift, error: activeShiftError } = await supabase
      .from('shifts')
      .select('id, vehicle_id, driver_id')
      .eq('driver_id', driverRecordId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeShiftError && !activeShift) {
      return { shiftId: null, error: activeShiftError.message };
    }

    if (activeShift) {
      setState(prev => ({ ...prev, activeShiftId: activeShift.id }));
      return {
        shiftId: activeShift.id,
        driverId: activeShift.driver_id ?? driverRecordId,
        shiftVehicleId: activeShift.vehicle_id ?? vehicleIdToUse,
      };
    }

    console.log('[StartShiftPath] source screen', { source: sourceScreen ?? 'unknown' });
    console.log('[Checklist] checklistAnswers present', { present: checklistPayload ? 'yes' : 'no' });
    if (!checklistPayload) {
      return { shiftId: null, error: 'Checklist is required before starting shift.' };
    }

    if (!isOnline) {
      const localShiftId = generateUuid();
      await queueWrite({
        id: `${Date.now()}-create-shift`,
        type: 'rpc_call',
        name: 'start_shift',
        params: {
          p_driver_id: driverRecordId,
          p_start_lat: startLat,
          p_start_lng: startLng,
          p_checklist: checklistPayload,
          p_device_info: { platform: 'expo' },
        },
      });
      setState(prev => ({ ...prev, activeShiftId: localShiftId }));
      return { shiftId: localShiftId, driverId: driverRecordId, queued: true, shiftVehicleId: vehicleIdToUse };
    }

    const { shiftId: newShiftId, error: rpcError } = await rpcStartShift({
      p_driver_id: driverRecordId,
      p_start_lat: startLat,
      p_start_lng: startLng,
      p_checklist: checklistPayload,
      p_device_info: { platform: 'expo' },
    });

    const normalizedShiftId = normalizeShiftId(newShiftId);

    if (rpcError || !normalizedShiftId) {
      return { shiftId: null, error: rpcError ?? 'Unable to create shift.' };
    }

    console.log('[StartShift] set activeShiftId', { shiftId: normalizedShiftId, source: 'ensureActiveShift' });
    setState(prev => ({ ...prev, activeShiftId: normalizedShiftId }));
    return { shiftId: normalizedShiftId, driverId: driverRecordId, shiftVehicleId: vehicleIdToUse };
  }, [resolveDriverRecordId, state.activeShiftId, state.driverRecordId, state.userId, state.vehicleId]);

  const submitPreStartChecklist = useCallback(
    async (payload: {
      answers: ChecklistAnswer[];
      hasFailures: boolean;
      hasCriticalFailures: boolean;
      assignmentVehicleId?: string | null;
    }) => {
      console.log('[Checklist] collected locally', {
        answers: payload.answers.length,
        hasFailures: payload.hasFailures,
        hasCriticalFailures: payload.hasCriticalFailures,
      });
      setState(prev => ({
        ...prev,
        checklistSubmitted: true,
        checklistCompleted: !payload.hasFailures,
        preStartChecklistAnswers: payload.answers,
      }));
      return { ok: true, shiftId: null, queued: false };
    },
    []
  );

  const startShift = useCallback(async (payload?: {
    odometerReading: string;
    odometerPhoto: string;
    capturedAt?: string;
    location?: { lat: number; lng: number; accuracy: number | null };
    checklistAnswers?: ChecklistAnswer[];
    sourceScreen?: string;
  }) => {
    const resolvedUserId = await resolveAuthUserId();
    if (!resolvedUserId) return { shiftId: null, error: 'User not available.' };

    const driverResolution = await resolveDriverRecordId(resolvedUserId);
    const driverRecordId = driverResolution.driverRecordId;
    if (!driverRecordId) {
      return { shiftId: null, error: driverResolution.error ?? 'Driver profile not available.' };
    }

    if (state.activeShiftId) {
      return { shiftId: state.activeShiftId };
    }

    const { vehicle: assignmentVehicle, error: assignmentError } = await getAssignedVehicleForCurrentUser();
    const assignmentVehicleId = assignmentVehicle?.id ?? null;
    if (!assignmentVehicleId) {
      return { shiftId: null, error: assignmentError ?? 'No active vehicle assignment. Refresh assignment to continue.' };
    }

    const odometerReading = payload?.odometerReading ?? state.odometerReading;
    const odometerPhoto = payload?.odometerPhoto ?? state.odometerPhoto;
    const checklistAnswers = payload?.checklistAnswers ?? state.preStartChecklistAnswers;
    const sourceScreen = payload?.sourceScreen ?? 'unknown';

    console.log('[StartShiftPath] source screen', { source: sourceScreen });
    console.log('[Checklist] checklistAnswers present', { present: checklistAnswers.length > 0 ? 'yes' : 'no' });

    if (payload?.odometerReading || payload?.odometerPhoto || payload?.checklistAnswers) {
      setState(prev => ({
        ...prev,
        odometerReading: payload?.odometerReading ?? prev.odometerReading,
        odometerPhoto: payload?.odometerPhoto ?? prev.odometerPhoto,
        preStartChecklistAnswers: payload?.checklistAnswers ?? prev.preStartChecklistAnswers,
      }));
    }

    const odometerValue = Number(odometerReading);
    if (!Number.isInteger(odometerValue) || odometerValue < 0) {
      return { shiftId: null, error: 'Odometer value must be a valid whole number.' };
    }

    console.log('[OdometerValidation] vehicleId', { vehicleId: assignmentVehicleId });
    console.log('[OdometerValidation] typedStart', { typedStart: odometerValue });
    const latestVehicleOdometerResult = await getLatestVehicleOdometerKm(assignmentVehicleId);
    if (latestVehicleOdometerResult.error) {
      return { shiftId: null, error: `Unable to validate odometer history: ${latestVehicleOdometerResult.error}` };
    }

    const latestVehicleOdometer = latestVehicleOdometerResult.value;
    console.log('[OdometerValidation] latestVehicleOdometer', { latestVehicleOdometer });
    if (latestVehicleOdometer !== null && odometerValue < latestVehicleOdometer) {
      const latestDisplay = Number.isInteger(latestVehicleOdometer)
        ? `${latestVehicleOdometer}`
        : latestVehicleOdometer.toFixed(1);
      const message = `Odometer cannot be less than the vehicle's last recorded reading of ${latestDisplay} km.`;
      console.warn('[OdometerValidation] blocked reason', { reason: message });
      return { shiftId: null, error: message };
    }

    if (!odometerPhoto) {
      return { shiftId: null, error: 'Odometer photo is required.' };
    }

    if (!checklistAnswers.length) {
      return { shiftId: null, error: 'Checklist is required before starting shift.' };
    }

    const checklistPayload = buildChecklistPayload(checklistAnswers);
    if (!checklistPayload) {
      return { shiftId: null, error: 'Checklist payload is missing.' };
    }

    let capturedAt = payload?.capturedAt ?? state.startOdometerCapturedAt ?? new Date().toISOString();
    let startLat = payload?.location?.lat ?? state.startOdometerLat;
    let startLng = payload?.location?.lng ?? state.startOdometerLng;
    let startAccuracy = payload?.location?.accuracy ?? state.startOdometerAccuracy;

    if (startLat === null || startLng === null) {
      try {
        const fix = await getGpsFix();
        startLat = fix.latitude;
        startLng = fix.longitude;
        startAccuracy = fix.accuracy;
        setState(prev => ({
          ...prev,
          startOdometerLat: startLat,
          startOdometerLng: startLng,
          startOdometerAccuracy: startAccuracy,
        }));
      } catch (e) {
        return { shiftId: null, error: 'Location is required to start shift.' };
      }
    }

    setState(prev => ({
      ...prev,
      startOdometerCapturedAt: capturedAt,
      shiftStartTime: prev.shiftStartTime ?? new Date(capturedAt),
    }));

    let { shiftId, error, queued, driverId, shiftVehicleId } = await ensureActiveShift(
      assignmentVehicleId,
      startLat,
      startLng,
      checklistPayload,
      sourceScreen
    );
    shiftId = normalizeShiftId(shiftId);
    if (!shiftId || error) {
      return { shiftId: null, error };
    }

    if (!driverId) {
      return { shiftId: null, error: 'User not available.' };
    }

    if (!shiftVehicleId && !assignmentVehicleId) {
      return { shiftId: null, error: 'Active shift vehicle not available. Refresh assignment.' };
    }

    if (shiftVehicleId && assignmentVehicleId && shiftVehicleId !== assignmentVehicleId) {
      let existingShift: { id: string; vehicle_id: string | null } | null = null;
      if (shiftId) {
        const { data: shiftData, error: shiftFetchError } = await supabase
          .from('shifts')
          .select('id, vehicle_id')
          .eq('id', shiftId)
          .maybeSingle();
        if (shiftFetchError) {
          console.warn('[ShiftMismatch] Failed to fetch active shift', { message: shiftFetchError.message });
        } else {
          existingShift = shiftData ?? null;
        }
      }

      console.log('[ShiftMismatch]', {
        activeShiftId: existingShift?.id ?? shiftId ?? state.activeShiftId,
        activeShiftVehicleId: existingShift?.vehicle_id ?? shiftVehicleId,
        assignmentVehicleId,
      });

      if (existingShift?.id && existingShift.vehicle_id && existingShift.vehicle_id !== assignmentVehicleId) {
        console.warn('[ShiftMismatch] Auto-closing mismatched shift', {
          shiftId: existingShift.id,
          fromVehicle: existingShift.vehicle_id,
          toVehicle: assignmentVehicleId,
        });

        // The end_shift RPC enforces driver_id = auth.uid() server-side, so
        // only the authenticated driver's shift can be closed.
        await rpcEndShift({ p_shift_id: existingShift.id, p_end_lat: null, p_end_lng: null });
        setState(prev => ({ ...prev, activeShiftId: null, shiftStarted: false }));
      }

      ({ shiftId, error, queued, driverId, shiftVehicleId } = await ensureActiveShift(
        assignmentVehicleId,
        startLat,
        startLng,
        checklistPayload,
        sourceScreen
      ));
      shiftId = normalizeShiftId(shiftId);
      if (!shiftId || error) {
        return { shiftId: null, error: error ?? 'Unable to create shift.' };
      }
    }

    const isOnline = await networkMonitor.isOnline();

    console.log('[StartShift] startShift result', { shiftId, queued: queued ?? false, driverId: driverId ?? null });

    console.log('[Checklist] saving to shifts.checklist');
    console.log('[Checklist] shiftId', { shiftId });
    console.log('[Checklist] payload', checklistPayload);
    const { error: checklistSaveError } = await supabase
      .from('shifts')
      .update({
        vehicle_id: assignmentVehicleId,
        checklist: checklistPayload,
      })
      .eq('id', shiftId);

    if (checklistSaveError) {
      console.error('[Checklist] error', {
        shiftId,
        payload: checklistPayload,
        message: checklistSaveError.message,
      });
      return { shiftId: null, error: `Checklist save failed: ${checklistSaveError.message}` };
    }

    console.log('[Checklist] success', { shiftId });

    let photoPath: string | null = null;
    let odometerStartQueued = queued ?? false;

    // Upload pre-shift photo to the odometer_photos bucket
    console.log('[StartShift] uploading odometer photo', { shiftId, userId: resolvedUserId });
    const { path: uploadedPhotoPath, error: photoError } = await uploadShiftPhoto(shiftId, 'pre', odometerPhoto, resolvedUserId);
    if (photoError || !uploadedPhotoPath) {
      console.error('[StartShift] upload odometer error', { shiftId, message: photoError ?? 'no path returned' });
      await offlineQueue.addEvent('odometer_start', {
        shift_id: shiftId,
        event_type: 'odometer_start',
        latitude: startLat,
        longitude: startLng,
        metadata: {
          odometer_value: odometerValue,
          unit: 'km',
          photo_path: null,
          local_photo_uri: odometerPhoto,
          upload_error: photoError ?? 'upload failed',
          captured_at: capturedAt,
          driver_id: driverId,
          vehicle_id: shiftVehicleId ?? assignmentVehicleId,
          shift_id: shiftId,
        },
      });
      odometerStartQueued = true;
    } else {
      photoPath = uploadedPhotoPath;
      console.log('[StartShift] upload odometer success', { shiftId, photoPath });

      if (isOnline) {
        const { error: shiftStartEventError } = await supabase.from('shift_events').insert({
          shift_id: shiftId,
          event_type: 'odometer_start',
          latitude: startLat,
          longitude: startLng,
          metadata: {
            odometer_value: odometerValue,
            unit: 'km',
            photo_path: photoPath,
            captured_at: capturedAt,
            driver_id: driverId,
            vehicle_id: shiftVehicleId ?? assignmentVehicleId,
            shift_id: shiftId,
          },
        });

        if (shiftStartEventError) {
          console.error('[StartShift] odometer_start event error', {
            shiftId,
            message: shiftStartEventError.message,
          });
          await offlineQueue.addEvent('odometer_start', {
            shift_id: shiftId,
            event_type: 'odometer_start',
            latitude: startLat,
            longitude: startLng,
            metadata: {
              odometer_value: odometerValue,
              unit: 'km',
              photo_path: photoPath,
              captured_at: capturedAt,
              driver_id: driverId,
              vehicle_id: shiftVehicleId ?? assignmentVehicleId,
              shift_id: shiftId,
              insert_error: shiftStartEventError.message,
            },
          });
          odometerStartQueued = true;
        }
      } else {
        await offlineQueue.addEvent('odometer_start', {
          shift_id: shiftId,
          event_type: 'odometer_start',
          latitude: startLat,
          longitude: startLng,
          metadata: {
            odometer_value: odometerValue,
            unit: 'km',
            photo_path: photoPath,
            captured_at: capturedAt,
            driver_id: driverId,
            vehicle_id: shiftVehicleId ?? assignmentVehicleId,
            shift_id: shiftId,
          },
        });
        odometerStartQueued = true;
      }
    }

    console.log('[StartShift] set activeShiftId', { shiftId, source: 'startShift' });
    setState(prev => ({
      ...prev,
      activeShiftId: shiftId,
      activeShiftVehicleId: assignmentVehicleId,
      activeShiftVehicleResolutionError: null,
      shiftStartTime: prev.shiftStartTime ?? new Date(capturedAt),
      shiftStarted: true,
    }));
    console.log('[Tracking] activeShiftId', {
      activeShiftId: shiftId,
      shiftStartTime: capturedAt,
      activeShiftVehicleId: assignmentVehicleId,
    });

    return { shiftId, queued: odometerStartQueued };
  }, [
    buildChecklistPayload,
    ensureActiveShift,
    getLatestVehicleOdometerKm,
    resolveDriverRecordId,
    state.preStartChecklistAnswers,
    state.activeShiftId,
    state.odometerReading,
    state.odometerPhoto,
    state.startOdometerCapturedAt,
    state.startOdometerLat,
    state.startOdometerLng,
    state.startOdometerAccuracy,
    state.userId,
    state.vehicleId,
  ]);

  const endShift = useCallback(async (payload: {
    endOdometerValue: number;
    endOdometerPhoto: string;
    capturedAt: string;
    location: { lat: number; lng: number; accuracy: number | null };
  }) => {
    console.log('[EndShift] start', { shiftId: state.activeShiftId ?? null });

    const resolvedUserId = await resolveAuthUserId();
    if (!resolvedUserId) return { ok: false, error: 'User not available.' };

    const driverResolution = await resolveDriverRecordId(resolvedUserId);
    const driverRecordId = driverResolution.driverRecordId;
    if (!driverRecordId) {
      return { ok: false, error: driverResolution.error ?? 'Driver profile not available.' };
    }

    let activeShiftId = state.activeShiftId;
    if (!activeShiftId) {
      const { data: activeShift, error: activeShiftError } = await supabase
        .from('shifts')
        .select('id, vehicle_id, started_at')
        .eq('driver_id', driverRecordId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeShiftError) {
        return { ok: false, error: `Unable to resolve active shift: ${activeShiftError.message}` };
      }

      if (!activeShift?.id) {
        return { ok: false, error: 'No active shift found.' };
      }

      activeShiftId = activeShift.id;
      setState(prev => ({
        ...prev,
        activeShiftId: activeShift.id,
        activeShiftVehicleId: activeShift.vehicle_id ?? prev.activeShiftVehicleId ?? null,
        activeShiftVehicleResolutionError: null,
        shiftStartTime: prev.shiftStartTime ?? (activeShift.started_at ? new Date(activeShift.started_at) : prev.shiftStartTime),
        shiftStarted: true,
      }));
      console.log('[EndShift] recovered active shift id', { shiftId: activeShift.id });
    }

    if (!activeShiftId) {
      return { ok: false, error: 'No active shift found.' };
    }

    const isOnline = await networkMonitor.isOnline();

    // Upload post-shift photo to the odometer_photos bucket
    console.log('[photoUpload] endShift: uploading odometer photo', { shiftId: activeShiftId, userId: resolvedUserId });
    const { path: uploadedPhotoPath, error: photoError } = await uploadShiftPhoto(
      activeShiftId,
      'post',
      payload.endOdometerPhoto,
      resolvedUserId
    );

    const endShiftVehicleId = state.activeShiftVehicleId ?? state.vehicleId ?? null;
    const odometerEndMetadata = {
      odometer_value: payload.endOdometerValue,
      unit: 'km',
      photo_path: uploadedPhotoPath ?? null,
      local_photo_uri: uploadedPhotoPath ? null : payload.endOdometerPhoto,
      captured_at: payload.capturedAt,
      driver_id: driverRecordId,
      vehicle_id: endShiftVehicleId,
      shift_id: activeShiftId,
      upload_error: photoError ?? null,
    } as Record<string, unknown>;

    let queued = false;

    if (photoError || !uploadedPhotoPath) {
      console.error('[EndShift] error', {
        shiftId: activeShiftId,
        error: photoError ?? 'no path returned',
      });
      await offlineQueue.addEvent('odometer_end', {
        shift_id: activeShiftId,
        event_type: 'odometer_end',
        latitude: payload.location.lat,
        longitude: payload.location.lng,
        metadata: odometerEndMetadata,
      });
      queued = true;
    } else if (!isOnline) {
      await offlineQueue.addEvent('odometer_end', {
        shift_id: activeShiftId,
        event_type: 'odometer_end',
        latitude: payload.location.lat,
        longitude: payload.location.lng,
        metadata: odometerEndMetadata,
      });
      queued = true;
    } else {
      const { error: shiftEventError } = await supabase.from('shift_events').insert({
        shift_id: activeShiftId,
        event_type: 'odometer_end',
        latitude: payload.location.lat,
        longitude: payload.location.lng,
        metadata: odometerEndMetadata,
      });

      if (shiftEventError) {
        console.error('[EndShift] error', {
          shiftId: activeShiftId,
          error: shiftEventError.message,
        });
        await offlineQueue.addEvent('odometer_end', {
          shift_id: activeShiftId,
          event_type: 'odometer_end',
          latitude: payload.location.lat,
          longitude: payload.location.lng,
          metadata: {
            ...odometerEndMetadata,
            insert_error: shiftEventError.message,
          },
        });
        queued = true;
      }
    }

    console.log('[EndShift] success', {
      shiftId: activeShiftId,
      step: 'odometer_end_event_inserted',
      odometerValue: payload.endOdometerValue,
    });

    let rpcOk = false;
    let rpcError: string | undefined;

    if (isOnline) {
      const rpcResult = await rpcEndShift({
        p_shift_id: activeShiftId,
        p_end_lat: payload.location.lat,
        p_end_lng: payload.location.lng,
      });
      rpcOk = rpcResult.ok;
      rpcError = rpcResult.error;
    }

    if (!isOnline || !rpcOk) {
      await queueWrite({
        id: `${Date.now()}-end-shift`,
        type: 'rpc_call',
        name: 'end_shift',
        params: {
          p_shift_id: activeShiftId,
          p_end_lat: payload.location.lat,
          p_end_lng: payload.location.lng,
        },
      });
      queued = true;
    }

    console.log('[EndShift] success OR error', {
      shiftId: activeShiftId,
      ok: rpcOk,
      error: rpcError ?? null,
      queued,
    });

    const queuedWrites = await loadWriteQueue();
    const filteredWrites = queuedWrites.filter(
      (item) => !(item.type === 'rpc_call' && item.name === 'start_shift')
    );
    await saveWriteQueue(filteredWrites);

    console.log('[EndShift] clearing state');
    setState(prev => {
      const next = {
        ...prev,
        activeShiftId: null,
        activeShiftVehicleId: null,
        activeShiftVehicleResolutionError: null,
        shiftStartTime: null,
        shiftStarted: false,
        isOnBreak: false,
        breakStartedAt: null,
        breakAccumulatedSeconds: 0,
        checklistSubmitted: false,
        checklistCompleted: false,
        preStartChecklistAnswers: [],
        endShiftRubbishRemoved: null,
        endShiftNotes: '',
        shiftNotes: [],
        odometerReading: '',
        odometerPhoto: '',
        startOdometerCapturedAt: null,
        startOdometerLat: null,
        startOdometerLng: null,
        startOdometerAccuracy: null,
        postShiftComplete: true,
      };
      console.log('[EndShift] state after clear', { activeShiftId: next.activeShiftId, postShiftComplete: next.postShiftComplete });
      return next;
    });
    return { ok: true, queued };
  }, [resolveDriverRecordId, state.activeShiftId, state.userId]);

  const closeActiveBreak = useCallback(
    async (options?: { queueOnError?: boolean }) => {
      if (!state.isOnBreak) return { closed: false, durationSeconds: 0 };

      const accumulated = state.breakAccumulatedSeconds ?? 0;
      const started = state.breakStartedAt ? new Date(state.breakStartedAt).getTime() : null;
      const runningDelta = started ? Math.floor((Date.now() - started) / 1000) : 0;
      const totalSeconds = accumulated + runningDelta;
      const result = await createEvent('break_end', { duration_seconds: totalSeconds }, options);
      updateAppState({ isOnBreak: false, breakStartedAt: null, breakAccumulatedSeconds: totalSeconds });

      return { closed: true, durationSeconds: totalSeconds, result };
    },
    [createEvent, state.breakAccumulatedSeconds, state.breakStartedAt, state.isOnBreak, updateAppState]
  );

  return (
    <AppStateContext.Provider
      value={{
        state,
        updateAppState,
        resetShift,
        clearSessionState,
        refreshCurrentVehicle,
        submitPreStartChecklist,
        startShift,
        endShift,
        createEvent,
        closeActiveBreak,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
