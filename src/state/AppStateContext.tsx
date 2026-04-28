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
    options?: { queueOnError?: boolean; locationOverride?: { latitude: number; longitude: number } }
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
      options?: { queueOnError?: boolean; locationOverride?: { latitude: number; longitude: number } }
    ) => {
      const queueOnError = options?.queueOnError ?? true;
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

      const shiftEvent = {
        shift_id: state.activeShiftId,
        event_type: eventType,
        latitude: location?.coords.latitude ?? null,
        longitude: location?.coords.longitude ?? null,
        metadata,
      };

      const isOnline = await networkMonitor.isOnline();

      if (!isOnline) {
        if (queueOnError) {
          await offlineQueue.addEvent(eventType, {
            shift_id: state.activeShiftId,
            latitude: location?.coords.latitude ?? null,
            longitude: location?.coords.longitude ?? null,
            metadata,
          });
          return { status: 'queued' as const, error: 'Device is offline' };
        }
        return { status: 'error' as const, error: 'Device is offline' };
      }

      await processEventQueue();

      const { error } = await supabase.from('shift_events').insert(shiftEvent);
      if (error) {
        console.error('Failed to create shift_event', { eventType, shiftId: state.activeShiftId, message: error.message });
        if (queueOnError) {
          await offlineQueue.addEvent(eventType, {
            shift_id: state.activeShiftId,
            latitude: location?.coords.latitude ?? null,
            longitude: location?.coords.longitude ?? null,
            metadata,
          });
          return { status: 'queued' as const, error: error.message };
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
    startLng: number | null = null
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
      p_device_info: { platform: 'expo' },
    });

    if (rpcError || !newShiftId) {
      return { shiftId: null, error: rpcError ?? 'Unable to create shift.' };
    }

    setState(prev => ({ ...prev, activeShiftId: newShiftId }));
    return { shiftId: newShiftId, driverId: driverRecordId, shiftVehicleId: vehicleIdToUse };
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
  }) => {
    const resolvedUserId = await resolveAuthUserId();
    if (!resolvedUserId) return { shiftId: null, error: 'User not available.' };

    const driverResolution = await resolveDriverRecordId(resolvedUserId);
    const driverRecordId = driverResolution.driverRecordId;
    if (!driverRecordId) {
      return { shiftId: null, error: driverResolution.error ?? 'Driver profile not available.' };
    }

    if (state.activeShiftId) {
      return { shiftId: state.activeShiftId, error: 'Shift already active.' };
    }

    const { vehicle: assignmentVehicle, error: assignmentError } = await getAssignedVehicleForCurrentUser();
    const assignmentVehicleId = assignmentVehicle?.id ?? null;
    if (!assignmentVehicleId) {
      return { shiftId: null, error: assignmentError ?? 'No active vehicle assignment. Refresh assignment to continue.' };
    }

    const odometerReading = payload?.odometerReading ?? state.odometerReading;
    const odometerPhoto = payload?.odometerPhoto ?? state.odometerPhoto;

    if (payload?.odometerReading || payload?.odometerPhoto) {
      setState(prev => ({
        ...prev,
        odometerReading: payload?.odometerReading ?? prev.odometerReading,
        odometerPhoto: payload?.odometerPhoto ?? prev.odometerPhoto,
      }));
    }

    const odometerValue = Number(odometerReading);
    if (!Number.isInteger(odometerValue) || odometerValue < 0) {
      return { shiftId: null, error: 'Odometer value must be a valid whole number.' };
    }

    if (!odometerPhoto) {
      return { shiftId: null, error: 'Odometer photo is required.' };
    }

    if (!state.preStartChecklistAnswers.length) {
      return { shiftId: null, error: 'Checklist is required before starting shift.' };
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
      startLng
    );
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
        startLng
      ));
      if (!shiftId || error) {
        return { shiftId: null, error: error ?? 'Unable to create shift.' };
      }
    }

    const isOnline = await networkMonitor.isOnline();

    if (!isOnline) {
      await offlineQueue.addEvent('shift_start', {
        shift_id: shiftId,
        latitude: startLat,
        longitude: startLng,
        metadata: { odometer_value: odometerValue },
      });
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
      return { shiftId, queued: true };
    }

    console.log('[StartShift] returned shift id', { shiftId });

    const checklistPayload = buildChecklistPayload(state.preStartChecklistAnswers);
    if (!checklistPayload) {
      return { shiftId: null, error: 'Checklist payload is missing.' };
    }

    console.log('[Checklist] saving to shifts.checklist', { shiftId });
    const { error: checklistSaveError } = await supabase
      .from('shifts')
      .update({
        vehicle_id: assignmentVehicleId,
        checklist: checklistPayload,
      })
      .eq('id', shiftId);

    if (checklistSaveError) {
      console.error('[Checklist] save error', {
        shiftId,
        message: checklistSaveError.message,
      });
      return { shiftId: null, error: `Checklist save failed: ${checklistSaveError.message}` };
    }
    console.log('[Checklist] save success', { shiftId });

    // Upload pre-shift photo to the odometer_photos bucket
    console.log('[photoUpload] startShift: uploading odometer photo', { shiftId, userId: resolvedUserId });
    const { path: photoPath, error: photoError } = await uploadShiftPhoto(shiftId, 'pre', odometerPhoto, resolvedUserId);
    if (photoError) {
      return { shiftId: null, error: `Failed to upload odometer photo: ${photoError}` };
    }

    // Log the shift start event with odometer metadata
    const { error: shiftStartEventError } = await supabase.from('shift_events').insert({
      shift_id: shiftId,
      event_type: 'shift_start',
      latitude: startLat,
      longitude: startLng,
      metadata: {
        odometer_value: odometerValue,
        photo_path: photoPath,
        captured_at: capturedAt,
      },
    });

    if (shiftStartEventError) {
      return { shiftId: null, error: `Failed to save shift start event: ${shiftStartEventError.message}` };
    }

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

    return { shiftId, queued };
  }, [
    buildChecklistPayload,
    ensureActiveShift,
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

    if (!isOnline) {
      await queueWrite({
        id: `${Date.now()}-end-shift`,
        type: 'rpc_call',
        name: 'end_shift',
        params: { p_shift_id: activeShiftId, p_end_lat: payload.location.lat, p_end_lng: payload.location.lng },
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
      return { ok: true, queued: true };
    }

    // Upload post-shift photo to the odometer_photos bucket
    console.log('[photoUpload] endShift: uploading odometer photo', { shiftId: activeShiftId, userId: resolvedUserId });
    const { path: photoPath, error: photoError } = await uploadShiftPhoto(
      activeShiftId,
      'post',
      payload.endOdometerPhoto,
      resolvedUserId
    );
    if (photoError) {
      console.error('[EndShift] error', {
        shiftId: activeShiftId,
        error: photoError,
      });
      return { ok: false, error: `Failed to upload odometer photo: ${photoError}` };
    }

    const { error: shiftEventError } = await supabase.from('shift_events').insert({
      shift_id: activeShiftId,
      event_type: 'shift_end',
      latitude: payload.location.lat,
      longitude: payload.location.lng,
      metadata: {
        odometer_value: payload.endOdometerValue,
        photo_path: photoPath,
        captured_at: payload.capturedAt,
      },
    });

    if (shiftEventError) {
      console.error('[EndShift] error', {
        shiftId: activeShiftId,
        error: shiftEventError.message,
      });
      return { ok: false, error: `Failed to log shift end event: ${shiftEventError.message}` };
    }

    console.log('[EndShift] success', {
      shiftId: activeShiftId,
      step: 'shift_end_event_inserted',
      odometerValue: payload.endOdometerValue,
    });

    const { ok: rpcOk, error: rpcError } = await rpcEndShift({
      p_shift_id: activeShiftId,
      p_end_lat: payload.location.lat,
      p_end_lng: payload.location.lng,
    });

    console.log('[EndShift] success OR error', {
      shiftId: activeShiftId,
      ok: rpcOk,
      error: rpcError ?? null,
    });

    if (!rpcOk) {
      console.error('Failed to end shift via RPC', { shiftId: activeShiftId, error: rpcError });
      return { ok: false, error: rpcError ?? 'Failed to end shift.' };
    }

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
    return { ok: true };
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
