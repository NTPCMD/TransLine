import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export interface VehicleInfo {
  registration: string;
  type: string;
  depot: string;
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
  shiftStarted: boolean;
  checklistCompleted: boolean;
  preStartChecklistAnswers: ChecklistAnswer[];
  odometerReading: string;
  odometerPhoto: string;
  shiftStartTime: Date | null;
  onBreak: boolean;
  lastFueled?: string | null;
  breakStartedAt?: string | null;
  breakAccumulatedSeconds?: number;
  shiftNotes: string[];
  endShiftRubbishRemoved: 'yes' | 'no' | null;
  endShiftNotes: string;
  userId: string | null;
  activeShiftId: string | null;
}

interface AppStateContextValue {
  state: AppState;
  updateAppState: (updates: Partial<AppState>) => void;
  resetShift: () => void;
  startShift: () => Promise<string | null>;
  endShift: () => Promise<boolean>;
  createEvent: (eventType: string, metadata?: Record<string, unknown>) => Promise<'sent' | 'queued'>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

const EVENT_QUEUE_KEY = 'transline:queuedEvents';

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

const initialState: AppState = {
  isLoggedIn: false,
  declarationAccepted: false,
  assignedVehicle: null,
  shiftStarted: false,
  checklistCompleted: false,
  preStartChecklistAnswers: [],
  odometerReading: '',
  odometerPhoto: '',
  shiftStartTime: null,
  onBreak: false,
  lastFueled: null,
  breakStartedAt: null,
  breakAccumulatedSeconds: 0,
  shiftNotes: [],
  endShiftRubbishRemoved: null,
  endShiftNotes: '',
  userId: null,
  activeShiftId: null,
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
    }));
  };

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({
        ...prev,
        userId: session?.user?.id ?? null,
        isLoggedIn: Boolean(session?.user),
      }));
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

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
        return false;
      }
      eventId = data?.id ?? eventId;
    }

    if (item.secondary) {
      const payload = eventId ? { ...item.secondary.payload, event_id: eventId } : item.secondary.payload;
      const { error } = await supabase.from(item.secondary.table).insert(payload);
      if (error) {
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

  useEffect(() => {
    if (state.userId) {
      processEventQueue();
    }
  }, [processEventQueue, state.userId]);

  const createEvent = useCallback(
    async (eventType: string, metadata: Record<string, unknown> = {}) => {
      const occurredAt = new Date().toISOString();
      const location = await resolveLocation();
      const vehicleId = state.assignedVehicle?.registration ?? null;
      const baseEvent = {
        shift_id: state.activeShiftId,
        driver_id: state.userId,
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
            driver_id: state.userId,
            vehicle_id: vehicleId,
            occurred_at: occurredAt,
            ...metadata,
          }
        : null;

      await processEventQueue();

      const { data, error } = await supabase.from('events').insert(baseEvent).select('id').single();
      if (error) {
        await queueEvent({
          id: `${Date.now()}-${eventType}`,
          event: baseEvent,
          secondary: secondaryTable && secondaryPayload ? { table: secondaryTable, payload: secondaryPayload } : undefined,
        });
        return 'queued';
      }

      const eventId = data?.id ?? null;

      if (secondaryTable && secondaryPayload) {
        const { error: secondaryError } = await supabase
          .from(secondaryTable)
          .insert(eventId ? { ...secondaryPayload, event_id: eventId } : secondaryPayload);
        if (secondaryError) {
          await queueEvent({
            id: `${Date.now()}-${eventType}`,
            event: baseEvent,
            skipEventInsert: true,
            eventId,
            secondary: { table: secondaryTable, payload: secondaryPayload },
          });
          return 'queued';
        }
      }

      return 'sent';
    },
    [processEventQueue, state.activeShiftId, state.assignedVehicle?.registration, state.userId]
  );

  const startShift = useCallback(async () => {
    if (!state.userId) {
      return null;
    }

    const vehicleId = state.assignedVehicle?.registration ?? null;
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        driver_id: state.userId,
        vehicle_id: vehicleId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      return null;
    }

    const shiftId = data?.id ?? null;
    setState(prev => ({ ...prev, activeShiftId: shiftId }));
    await createEvent('shift_start', {});
    return shiftId;
  }, [createEvent, state.assignedVehicle?.registration, state.userId]);

  const endShift = useCallback(async () => {
    if (!state.activeShiftId) {
      return false;
    }

    const { error } = await supabase
      .from('shifts')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', state.activeShiftId);

    if (error) {
      return false;
    }

    setState(prev => ({ ...prev, activeShiftId: null }));
    return true;
  }, [state.activeShiftId]);

  return (
    <AppStateContext.Provider value={{ state, updateAppState, resetShift, startShift, endShift, createEvent }}>
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
