import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useDriver } from './DriverContext';
import { useActiveAssignment } from './AssignmentContext';
import { getGpsFix } from '../lib/gps';
import { networkMonitor } from '../lib/networkMonitor';
import { offlineQueue } from '../lib/offlineQueue';
import { locationTracker } from '../lib/locationTracking';

export interface VehicleInfo {
  registration: string | null;
  type: string | null;
  depot: string | null;
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
  // drivers.id (driver record primary key) resolved from auth user
  driverRecordId: string | null;
  activeShiftId: string | null;
  queuedEventsCount: number;
}

interface AppStateContextValue {
  state: AppState;
  updateAppState: (updates: Partial<AppState>) => void;
  resetShift: () => void;
  submitPreStartChecklist: (payload: {
    answers: ChecklistAnswer[];
    hasFailures: boolean;
    hasCriticalFailures: boolean;
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
    options?: { queueOnError?: boolean }
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
const SHIFT_STATE_KEY = 'transline:shiftState';

type EventQueueItem = {
  id: string;
  skipEventInsert?: boolean;
  eventId?: string | null;
  event: {
    shift_id: string | null;
    driver_id: string | null;
    vehicle_id: string | null;
    event_type: string;
    occurred_at: string;
    lat?: number | null;
    lng?: number | null;
    heading?: number | null;
    metadata: Record<string, unknown>;
  };
  secondary?: {
    table: 'fuel_logs' | 'incidents' | 'notes';
    payload: Record<string, unknown>;
  };
};

type QueuedWrite = {
  id: string;
  type: 'create_shift' | 'checklist' | 'start_odometer' | 'end_odometer';
  payload: Record<string, unknown>;
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
  queuedEventsCount: 0,
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
  const { authUserId, currentDriver } = useDriver();
  const { status: assignmentStatus, vehicle: assignedVehicle } = useActiveAssignment();

  // Subscribe to offline queue changes
  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((queue) => {
      setState(prev => ({ ...prev, queuedEventsCount: queue.length }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const restoreShiftState = async () => {
      const stored = await AsyncStorage.getItem(SHIFT_STATE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as {
          activeShiftId?: string | null;
          shiftStartTime?: string | null;
          odometerReading?: string;
          shiftStarted?: boolean;
        };
        setState(prev => ({
          ...prev,
          activeShiftId: parsed.activeShiftId ?? prev.activeShiftId,
          shiftStartTime: parsed.shiftStartTime ? new Date(parsed.shiftStartTime) : prev.shiftStartTime,
          odometerReading: parsed.odometerReading ?? prev.odometerReading,
          shiftStarted: parsed.shiftStarted ?? prev.shiftStarted,
        }));
      } catch (error) {
        console.warn('Failed to restore shift state', error);
      }
    };

    restoreShiftState();
  }, []);

  useEffect(() => {
    const persistShiftState = async () => {
      try {
        await AsyncStorage.setItem(
          SHIFT_STATE_KEY,
          JSON.stringify({
            activeShiftId: state.activeShiftId,
            shiftStartTime: state.shiftStartTime ? state.shiftStartTime.toISOString() : null,
            odometerReading: state.odometerReading,
            shiftStarted: state.shiftStarted,
          })
        );
      } catch (error) {
        console.warn('Failed to persist shift state', error);
      }
    };

    persistShiftState();
  }, [state.activeShiftId, state.shiftStartTime, state.odometerReading, state.shiftStarted]);

  useEffect(() => {
    setState(prev => ({
      ...prev,
      userId: authUserId,
      isLoggedIn: Boolean(authUserId),
      driverRecordId: currentDriver?.id ?? prev.driverRecordId,
      vehicleId:
        assignmentStatus === 'loading'
          ? prev.vehicleId
          : assignedVehicle?.id ?? null,
      assignedVehicle:
        assignmentStatus === 'loading'
          ? prev.assignedVehicle
          : assignedVehicle
            ? {
                registration: assignedVehicle.registration ?? null,
                type: assignedVehicle.type ?? null,
                depot: assignedVehicle.depot ?? null,
              }
            : null,
      vehicleRegistration:
        assignmentStatus === 'loading'
          ? prev.vehicleRegistration
          : assignedVehicle?.registration ?? null,
    }));
  }, [authUserId, currentDriver, assignmentStatus, assignedVehicle]);

  useEffect(() => {
    console.log('shift state updated', {
      activeShiftId: state.activeShiftId,
      shiftStarted: state.shiftStarted,
      shiftStartTime: state.shiftStartTime,
    });
  }, [state.activeShiftId, state.shiftStarted, state.shiftStartTime]);

  useEffect(() => {
    const lookupVehicleFromRegistration = async (registration: string) => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, registration')
        .eq('registration', registration)
        .single();
      if (error || !data) {
        console.warn('Unable to backfill vehicle id from registration', { registration, message: error?.message });
        return;
      }
      setState(prev => ({
        ...prev,
        vehicleId: data.id,
        vehicleRegistration: data.registration,
      }));
    };

    const storedVehicleId = state.vehicleId;
    if (!storedVehicleId) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storedVehicleId);
    if (!isUuid && storedVehicleId.includes('-')) {
      void lookupVehicleFromRegistration(storedVehicleId);
    }
  }, [state.vehicleId]);

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

  const queueEvent = async (item: EventQueueItem) => {
    const queue = await loadQueuedEvents();
    queue.push(item);
    await saveQueuedEvents(queue);
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
      if (uid) {
        setState(prev => ({ ...prev, userId: uid, isLoggedIn: true }));
      }
      return uid;
    } catch {
      return null;
    }
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

  const saveWriteQueue = async (queue: QueuedWrite[]) => {
    await AsyncStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(queue));
  };

  const queueWrite = async (item: QueuedWrite) => {
    const queue = await loadWriteQueue();
    queue.push(item);
    await saveWriteQueue(queue);
  };

  const uploadOdometerPhoto = async (
    photoUri: string,
    shiftId: string,
    prefix: 'start' | 'end',
    authUserId: string | null
  ) => {
    if (!photoUri) {
      throw new Error('Photo URI is empty');
    }

    if (!authUserId) {
      throw new Error('User not available.');
    }

    let blob: Blob;
    let mimeType: string | null = null;
    try {
      if (photoUri.startsWith('data:')) {
        // Handle base64 data URI
        const parts = photoUri.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(parts[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        blob = new Blob([u8arr], { type: mimeType });
      } else if (photoUri.startsWith('file://')) {
        // Handle file URI
        const resp = await fetch(photoUri);
        if (!resp.ok) {
          throw new Error(`Failed to fetch photo: ${resp.status} ${resp.statusText}`);
        }
        blob = await resp.blob();
        mimeType = blob.type || null;
      } else {
        // Handle other URIs (http, https, etc)
        const resp = await fetch(photoUri);
        if (!resp.ok) {
          throw new Error(`Failed to fetch photo: ${resp.status} ${resp.statusText}`);
        }
        blob = await resp.blob();
        mimeType = blob.type || null;
      }
    } catch (e) {
      throw new Error(`Failed to process photo URI: ${e instanceof Error ? e.message : String(e)}`);
    }

    const extFromMime = (type: string | null) => {
      switch (type) {
        case 'image/png':
          return 'png';
        case 'image/webp':
          return 'webp';
        case 'image/heic':
          return 'heic';
        case 'image/heif':
          return 'heif';
        case 'image/jpeg':
        default:
          return 'jpg';
      }
    };

    let ext = 'jpg';
    if (photoUri.startsWith('data:')) {
      ext = extFromMime(mimeType);
    } else {
      const trimmed = photoUri.split('?')[0].split('#')[0];
      const lastDot = trimmed.lastIndexOf('.');
      if (lastDot > -1 && lastDot < trimmed.length - 1) {
        ext = trimmed.slice(lastDot + 1).toLowerCase();
      } else {
        ext = extFromMime(mimeType);
      }
    }
    const key = `${authUserId}/odometer/${prefix}_${shiftId}_${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase
      .storage
      .from('odometer_photos')
      .upload(key, blob, { contentType: mimeType ?? undefined });
    if (uploadErr) {
      throw new Error(uploadErr.message);
    }
    return key;
  };

  const resolveLocation = async () => {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.status !== 'granted') {
        return null;
      }
    }

    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  };

  const processQueueItem = async (item: EventQueueItem): Promise<boolean> => {
    let eventId = item.eventId ?? null;

    if (!item.skipEventInsert) {
      const { data, error } = await supabase.from('events').insert(item.event).select('id').single();
      if (error) {
        console.error('Failed to insert queued event', {
          eventType: item.event.event_type,
          shiftId: item.event.shift_id,
          message: error.message,
        });
        return false;
      }
      eventId = data?.id ?? eventId;
    }

    if (item.secondary) {
      const payload = eventId ? { ...item.secondary.payload, event_id: eventId } : item.secondary.payload;
      const { error } = await supabase.from(item.secondary.table).insert(payload);
      if (error) {
        console.error('Failed to insert queued event secondary payload', {
          eventType: item.event.event_type,
          shiftId: item.event.shift_id,
          message: error.message,
        });
        return false;
      }
    }

    return true;
  };

  const processEventQueue = useCallback(async () => {
    const queue = await loadQueuedEvents();
    if (queue.length === 0) return;

    const remaining: EventQueueItem[] = [];
    for (const item of queue) {
      const success = await processQueueItem(item);
      if (!success) {
        remaining.push(item);
      }
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
        if (item.type === 'create_shift') {
          const payload = item.payload as {
            shift_id: string;
            driver_id: string;
            vehicle_id: string;
            status: string;
          };
          const { error } = await supabase
            .from('shifts')
            .upsert(
              {
                id: payload.shift_id,
                driver_id: payload.driver_id,
                vehicle_id: payload.vehicle_id,
                status: payload.status,
              },
              { onConflict: 'id' }
            );
          if (error) throw error;
        }

        if (item.type === 'checklist') {
          const payload = item.payload as {
            id: string;
            shift_id: string;
            driver_id: string;
            vehicle_id: string;
            submitted_at: string;
            has_failures: boolean;
            has_critical_failures: boolean;
            answers: ChecklistAnswer[];
          };
          const { error } = await supabase
            .from('pre_start_checklists')
            .upsert(
              {
                id: payload.id,
                shift_id: payload.shift_id,
                driver_id: payload.driver_id,
                vehicle_id: payload.vehicle_id,
                submitted_at: payload.submitted_at,
                has_failures: payload.has_failures,
                has_critical_failures: payload.has_critical_failures,
                answers: payload.answers,
              },
              { onConflict: 'id' }
            );
          if (error) throw error;
        }

        if (item.type === 'start_odometer') {
          const payload = item.payload as {
            log_id: string;
            shift_id: string;
            driver_id: string;
            vehicle_id: string;
            odometer_value: number;
            photo_uri: string;
            captured_at: string;
            lat: number;
            lng: number;
            accuracy_m: number | null;
          };
          const authUserId = await resolveAuthUserId();
          const photoPath = await uploadOdometerPhoto(payload.photo_uri, payload.shift_id, 'start', authUserId);
          const { error: shiftError } = await supabase
            .from('shifts')
            .update({
              status: 'active',
              started_at: payload.captured_at,
              start_odometer: payload.odometer_value,
              start_odometer_photo_path: photoPath,
            })
            .eq('id', payload.shift_id);
          if (shiftError) throw shiftError;

          const { error: logError } = await supabase.from('odometer_logs').insert({
            id: payload.log_id,
            driver_id: payload.driver_id,
            vehicle_id: payload.vehicle_id,
            shift_id: payload.shift_id,
            odometer_value: payload.odometer_value,
            photo_path: photoPath,
            lat: payload.lat,
            lng: payload.lng,
            accuracy_m: payload.accuracy_m,
            recorded_at: payload.captured_at,
          });
          if (logError && logError.code !== '23505') throw logError;
        }

        if (item.type === 'end_odometer') {
          const payload = item.payload as {
            log_id: string;
            shift_id: string;
            driver_id: string;
            vehicle_id: string;
            odometer_value: number;
            photo_uri: string;
            captured_at: string;
            lat: number;
            lng: number;
            accuracy_m: number | null;
          };
          const { data: shift } = await supabase
            .from('shifts')
            .select('start_odometer, end_odometer')
            .eq('id', payload.shift_id)
            .maybeSingle();
          if (!shift?.start_odometer || shift.end_odometer) {
            continue;
          }

          const authUserId = await resolveAuthUserId();
          const photoPath = await uploadOdometerPhoto(payload.photo_uri, payload.shift_id, 'end', authUserId);
          const { error: shiftError } = await supabase
            .from('shifts')
            .update({
              status: 'ended',
              ended_at: payload.captured_at,
              end_odometer: payload.odometer_value,
              end_odometer_photo_path: photoPath,
            })
            .eq('id', payload.shift_id);
          if (shiftError) throw shiftError;

          const { error: logError } = await supabase.from('odometer_logs').insert({
            id: payload.log_id,
            driver_id: payload.driver_id,
            vehicle_id: payload.vehicle_id,
            shift_id: payload.shift_id,
            odometer_value: payload.odometer_value,
            photo_path: photoPath,
            lat: payload.lat,
            lng: payload.lng,
            accuracy_m: payload.accuracy_m,
            recorded_at: payload.captured_at,
          });
          if (logError && logError.code !== '23505') throw logError;
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

    return () => {
      unsubscribe();
    };
  }, [processEventQueue, processWriteQueue]);

  const createEvent = useCallback(
    async (eventType: string, metadata: Record<string, unknown> = {}, options?: { queueOnError?: boolean }) => {
      const queueOnError = options?.queueOnError ?? true;
      const occurredAt = new Date().toISOString();
      const location = await resolveLocation();
      const vehicleId = state.vehicleId;
      const driverId = state.driverRecordId;
      if (!driverId) {
        return { status: 'error' as const, error: 'Driver profile not available.' };
      }

      const baseEvent = {
        shift_id: state.activeShiftId,
        driver_id: driverId,
        vehicle_id: vehicleId,
        event_type: eventType,
        occurred_at: occurredAt,
        lat: location?.coords.latitude ?? null,
        lng: location?.coords.longitude ?? null,
        heading: location?.coords.heading ?? null,
        metadata,
      };

      const secondaryTable =
        eventType === 'fuel_log' ? 'fuel_logs' : eventType === 'incident' ? 'incidents' : eventType === 'note' ? 'notes' : null;

      const secondaryPayload = secondaryTable
        ? {
            shift_id: state.activeShiftId,
            driver_id: driverId,
            vehicle_id: vehicleId,
            occurred_at: occurredAt,
            ...metadata,
          }
        : null;

      // Check network connectivity
      const isOnline = await networkMonitor.isOnline();
      
      // If offline, queue immediately
      if (!isOnline) {
        if (queueOnError) {
          await offlineQueue.addEvent(eventType, {
            shift_id: state.activeShiftId,
            driver_id: driverId,
            vehicle_id: vehicleId,
            lat: location?.coords.latitude ?? null,
            lng: location?.coords.longitude ?? null,
            heading: location?.coords.heading ?? null,
            metadata,
          });
          return { status: 'queued' as const, error: 'Device is offline' };
        }
        return { status: 'error' as const, error: 'Device is offline' };
      }

      await processEventQueue();

      const { data, error } = await supabase.from('events').insert(baseEvent).select('id').single();
      if (error) {
        console.error('Failed to create event', { eventType, shiftId: state.activeShiftId, message: error.message });
        if (queueOnError) {
          // Use new offline queue instead of old queue
          await offlineQueue.addEvent(eventType, {
            shift_id: state.activeShiftId,
            driver_id: driverId,
            vehicle_id: vehicleId,
            lat: location?.coords.latitude ?? null,
            lng: location?.coords.longitude ?? null,
            heading: location?.coords.heading ?? null,
            metadata,
          });
          return { status: 'queued' as const, error: error.message };
        }
        return { status: 'error' as const, error: error.message };
      }

      const eventId = data?.id ?? null;

      if (secondaryTable && secondaryPayload) {
        const { error: secondaryError } = await supabase
          .from(secondaryTable)
          .insert(eventId ? { ...secondaryPayload, event_id: eventId } : secondaryPayload);
        if (secondaryError) {
          console.error('Failed to create event secondary payload', {
            eventType,
            shiftId: state.activeShiftId,
            message: secondaryError.message,
          });
          if (queueOnError) {
            // For secondary errors, we still need to use the old queueEvent to handle the eventId
            await queueEvent({
              id: `${Date.now()}-${eventType}`,
              event: baseEvent,
              skipEventInsert: true,
              eventId,
              secondary: { table: secondaryTable, payload: secondaryPayload },
            });
            return { status: 'queued' as const, error: secondaryError.message };
          }
          return { status: 'error' as const, error: secondaryError.message };
        }
      }

      return { status: 'sent' as const };
    },
    [processEventQueue, state.activeShiftId, state.driverRecordId, state.userId, state.vehicleId]
  );

  const ensureActiveShift = useCallback(async () => {
    const resolvedUserId = await resolveAuthUserId();
    if (!resolvedUserId) {
      return { shiftId: null, error: 'User not available.' };
    }

    const driverRecordId = state.driverRecordId;
    if (!driverRecordId) {
      return { shiftId: null, error: 'Driver profile not available.' };
    }

    const driverIdCandidates = [driverRecordId];
    if (resolvedUserId && resolvedUserId !== driverRecordId) {
      driverIdCandidates.push(resolvedUserId);
    }

    if (!state.vehicleId) {
      return { shiftId: null, error: 'No vehicle assigned. Contact admin.' };
    }

    if (state.activeShiftId) {
      return { shiftId: state.activeShiftId, driverId: driverRecordId };
    }

    let activeShift: { id: string; vehicle_id: string | null; driver_id: string | null } | null = null;
    let activeShiftError: string | null = null;
    let activeShiftDriverId = driverRecordId;

    for (const candidateDriverId of driverIdCandidates) {
      const { data, error } = await supabase
        .from('shifts')
        .select('id, vehicle_id, driver_id')
        .eq('driver_id', candidateDriverId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        activeShift = data;
        activeShiftDriverId = candidateDriverId;
        break;
      }

      if (error) {
        activeShiftError = error.message;
        if (!error.message.toLowerCase().includes('row-level security')) {
          break;
        }
      }
    }

    if (activeShiftError && !activeShift) {
      return { shiftId: null, error: activeShiftError };
    }

    if (activeShift) {
      if (activeShift.vehicle_id && activeShift.vehicle_id !== state.vehicleId) {
        return { shiftId: null, error: 'Active shift is assigned to a different vehicle.' };
      }
      setState(prev => ({ ...prev, activeShiftId: activeShift.id }));
      return { shiftId: activeShift.id, driverId: activeShift.driver_id ?? activeShiftDriverId };
    }

    const isOnline = await networkMonitor.isOnline();
    if (!isOnline) {
      const localShiftId = generateUuid();
      const queuedDriverId = driverRecordId;
      await queueWrite({
        id: `${Date.now()}-create-shift`,
        type: 'create_shift',
        payload: {
          shift_id: localShiftId,
          driver_id: queuedDriverId,
          vehicle_id: state.vehicleId,
          status: 'pending',
        },
      });
      setState(prev => ({ ...prev, activeShiftId: localShiftId }));
      return { shiftId: localShiftId, driverId: queuedDriverId, queued: true };
    }

    let insertError: string | null = null;
    for (const candidateDriverId of driverIdCandidates) {
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          driver_id: driverRecordId,
          vehicle_id: state.vehicleId,
          status: 'pending',
        })
        .select('id')
        .single();

      if (!error) {
        const shiftId = data?.id ?? null;
        setState(prev => ({ ...prev, activeShiftId: shiftId }));
        return { shiftId, driverId: driverRecordId };
      }

      insertError = `Shift insert failed: ${error.message}`;
      if (!error.message.toLowerCase().includes('row-level security')) {
        break;
      }
    }

    return { shiftId: null, error: insertError ?? 'Unable to create shift.' };
  }, [state.activeShiftId, state.driverRecordId, state.userId, state.vehicleId]);

  const submitPreStartChecklist = useCallback(
    async (payload: { answers: ChecklistAnswer[]; hasFailures: boolean; hasCriticalFailures: boolean }) => {
      const resolvedUserId = await resolveAuthUserId();
      if (!resolvedUserId) {
        return { ok: false, shiftId: null, error: 'User not available.' };
      }

      const driverRecordId = state.driverRecordId;
      if (!driverRecordId) {
        return { ok: false, shiftId: null, error: 'Driver profile not available.' };
      }

      const { shiftId, error, queued, driverId } = await ensureActiveShift();
      if (!shiftId || error) {
        return { ok: false, shiftId: null, error };
      }

      if (!driverId) {
        return { ok: false, shiftId: null, error: 'User not available.' };
      }

      const submissionId = generateUuid();
      const submittedAt = new Date().toISOString();
      const checklistPayload = {
        id: submissionId,
        shift_id: shiftId,
        driver_id: driverRecordId,
        vehicle_id: state.vehicleId as string,
        submitted_at: submittedAt,
        has_failures: payload.hasFailures,
        has_critical_failures: payload.hasCriticalFailures,
        answers: payload.answers,
      };

      const isOnline = await networkMonitor.isOnline();
      if (!isOnline) {
        await queueWrite({ id: `${Date.now()}-checklist`, type: 'checklist', payload: checklistPayload });
        setState(prev => ({
          ...prev,
          checklistSubmitted: true,
          checklistCompleted: !payload.hasFailures,
          preStartChecklistAnswers: payload.answers,
        }));
        return { ok: true, shiftId, queued: true };
      }

      const { error: submitError } = await supabase.from('pre_start_checklists').insert(checklistPayload);
      if (submitError) {
        return { ok: false, shiftId, error: `Checklist insert failed: ${submitError.message}` };
      }

      setState(prev => ({
        ...prev,
        checklistSubmitted: true,
        checklistCompleted: !payload.hasFailures,
        preStartChecklistAnswers: payload.answers,
      }));
      return { ok: true, shiftId, queued };
    },
    [ensureActiveShift, state.driverRecordId, state.vehicleId]
  );

  const startShift = useCallback(async (payload?: {
    odometerReading: string;
    odometerPhoto: string;
    capturedAt?: string;
    location?: { lat: number; lng: number; accuracy: number | null };
  }) => {
    if (!state.checklistSubmitted) {
      return { shiftId: null, error: 'Complete the checklist before capturing the odometer.' };
    }

    const resolvedUserId = await resolveAuthUserId();
    if (!resolvedUserId) {
      return { shiftId: null, error: 'User not available.' };
    }

    const driverRecordId = state.driverRecordId;
    if (!driverRecordId) {
      return { shiftId: null, error: 'Driver profile not available.' };
    }

    if (!state.vehicleId) {
      return { shiftId: null, error: 'No vehicle assigned. Contact admin.' };
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
      return { shiftId: null, error: 'Odometer photo with GPS data is required.' };
    }

    let capturedAt = payload?.capturedAt ?? state.startOdometerCapturedAt;
    let startLat = payload?.location?.lat ?? state.startOdometerLat;
    let startLng = payload?.location?.lng ?? state.startOdometerLng;
    let startAccuracy = payload?.location?.accuracy ?? state.startOdometerAccuracy;

    if (!capturedAt) {
      capturedAt = new Date().toISOString();
      setState(prev => ({
        ...prev,
        startOdometerCapturedAt: capturedAt,
        shiftStartTime: prev.shiftStartTime ?? new Date(capturedAt),
      }));
    }

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
        return { shiftId: null, error: 'Odometer photo with GPS data is required.' };
      }
    }

    if (payload?.capturedAt || payload?.location) {
      setState(prev => ({
        ...prev,
        startOdometerCapturedAt: capturedAt,
        startOdometerLat: startLat,
        startOdometerLng: startLng,
        startOdometerAccuracy: startAccuracy,
      }));
    }

    const { shiftId, error, queued, driverId } = await ensureActiveShift();
    if (!shiftId || error) {
      return { shiftId: null, error };
    }

    if (!driverId) {
      return { shiftId: null, error: 'User not available.' };
    }

    const isOnline = await networkMonitor.isOnline();
    const startPayload = {
      log_id: generateUuid(),
      shift_id: shiftId,
      driver_id: driverRecordId,
      vehicle_id: state.vehicleId,
      odometer_value: odometerValue,
      photo_uri: odometerPhoto,
      captured_at: capturedAt,
      lat: startLat,
      lng: startLng,
      accuracy_m: startAccuracy,
    };

    if (!isOnline) {
      await queueWrite({ id: `${Date.now()}-start-odometer`, type: 'start_odometer', payload: startPayload });
      await createEvent('shift_start', {});
      return { shiftId, queued: true };
    }

    let odometerPhotoPath: string | null = null;
    try {
      odometerPhotoPath = await uploadOdometerPhoto(odometerPhoto, shiftId, 'start', resolvedUserId);
    } catch (e) {
      return { shiftId: null, error: e instanceof Error ? e.message : 'Failed to upload odometer photo.' };
    }

    const { error: shiftError } = await supabase
      .from('shifts')
      .update({
        status: 'active',
        started_at: capturedAt,
        start_odometer: odometerValue,
        start_odometer_photo_path: odometerPhotoPath,
      })
      .eq('id', shiftId);

    if (shiftError) {
      console.error('Failed to start shift', { shiftId, message: shiftError.message });
      return { shiftId: null, error: shiftError.message };
    }

    const { error: logError } = await supabase.from('odometer_logs').insert({
      id: startPayload.log_id,
      driver_id: driverRecordId,
      vehicle_id: state.vehicleId,
      shift_id: shiftId,
      odometer_value: odometerValue,
      photo_path: odometerPhotoPath,
      lat: startLat,
      lng: startLng,
      accuracy_m: startAccuracy,
      recorded_at: capturedAt,
    });
    if (logError) {
      console.error('Failed to log start odometer', { shiftId, message: logError.message });
      return { shiftId: null, error: `Odometer log insert failed: ${logError.message}` };
    }

    await createEvent('shift_start', {});
    await locationTracker.startTracking(shiftId);
    return { shiftId, queued };
  }, [
    createEvent,
    ensureActiveShift,
    state.checklistSubmitted,
    state.driverRecordId,
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
    if (!state.activeShiftId) {
      return { ok: false, error: 'No active shift found.' };
    }

    const resolvedUserId = await resolveAuthUserId();
    if (!resolvedUserId) {
      return { ok: false, error: 'User not available.' };
    }

    const driverRecordId = state.driverRecordId;
    if (!driverRecordId) {
      return { ok: false, error: 'Driver profile not available.' };
    }

    // Stop location tracking first
    locationTracker.stopTracking();

    const isOnline = await networkMonitor.isOnline();
    const endPayload = {
      log_id: generateUuid(),
      shift_id: state.activeShiftId,
      driver_id: driverRecordId,
      vehicle_id: state.vehicleId,
      odometer_value: payload.endOdometerValue,
      photo_uri: payload.endOdometerPhoto,
      captured_at: payload.capturedAt,
      lat: payload.location.lat,
      lng: payload.location.lng,
      accuracy_m: payload.location.accuracy,
    };

    if (!isOnline) {
      await queueWrite({ id: `${Date.now()}-end-odometer`, type: 'end_odometer', payload: endPayload });
      return { ok: true, queued: true };
    }

    const { data: shiftData, error: shiftFetchError } = await supabase
      .from('shifts')
      .select('start_odometer, end_odometer')
      .eq('id', state.activeShiftId)
      .maybeSingle();
    if (shiftFetchError) {
      return { ok: false, error: shiftFetchError.message };
    }
    if (!shiftData?.start_odometer) {
      return { ok: false, error: 'Start odometer missing. Please capture it before ending the shift.' };
    }
    if (shiftData.end_odometer) {
      return { ok: false, error: 'End odometer already captured.' };
    }

    let endOdometerPhotoPath: string | null = null;
    try {
      endOdometerPhotoPath = await uploadOdometerPhoto(
        payload.endOdometerPhoto,
        state.activeShiftId,
        'end',
        resolvedUserId
      );
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Failed to upload odometer photo.' };
    }

    const { error } = await supabase
      .from('shifts')
      .update({
        status: 'ended',
        ended_at: payload.capturedAt,
        end_odometer: payload.endOdometerValue,
        end_odometer_photo_path: endOdometerPhotoPath,
      })
      .eq('id', state.activeShiftId);

    if (error) {
      console.error('Failed to end shift', { shiftId: state.activeShiftId, message: error.message });
      return { ok: false, error: error.message };
    }

    const { error: logError } = await supabase.from('odometer_logs').insert({
      id: endPayload.log_id,
      driver_id: driverRecordId,
      vehicle_id: state.vehicleId,
      shift_id: state.activeShiftId,
      odometer_value: payload.endOdometerValue,
      photo_path: endOdometerPhotoPath,
      lat: payload.location.lat,
      lng: payload.location.lng,
      accuracy_m: payload.location.accuracy,
      recorded_at: payload.capturedAt,
    });
    if (logError) {
      return { ok: false, error: logError.message };
    }

    setState(prev => ({ ...prev, activeShiftId: null }));
    return { ok: true };
  }, [state.activeShiftId, state.driverRecordId, state.userId, state.vehicleId]);

  const closeActiveBreak = useCallback(
    async (options?: { queueOnError?: boolean }) => {
      if (!state.isOnBreak) {
        return { closed: false, durationSeconds: 0 };
      }

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
    <AppStateContext.Provider value={{ state, updateAppState, resetShift, submitPreStartChecklist, startShift, endShift, createEvent, closeActiveBreak }}>
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
