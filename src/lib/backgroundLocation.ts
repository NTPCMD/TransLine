import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

// Background location tracking for active shifts. expo-location delivers fixes
// to this OS-registered task even when the app is backgrounded or closed, so a
// driver's route keeps recording without the app being open. The task runs in a
// headless JS context, so it cannot read React state — the active shift id is
// persisted to AsyncStorage and read back here.

export const BACKGROUND_LOCATION_TASK = 'transline-background-location';
const ACTIVE_SHIFT_KEY = 'transline:bgActiveShiftId';
const BG_LOCATION_QUEUE_KEY = 'transline:bgLocationQueue';
const MAX_QUEUED_BREADCRUMBS = 500;

type BackgroundLocationRow = {
  shift_id: string;
  event_type: 'location';
  latitude: number;
  longitude: number;
  created_at: string;
  metadata: Record<string, unknown>;
};

async function getActiveShiftId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
  } catch {
    return null;
  }
}

// Best-effort local buffer for breadcrumbs captured while offline in the
// background. Kept on a dedicated key so it cannot collide with the main
// offline queue's in-memory state, and drained by drainBackgroundLocationQueue.
async function bufferBreadcrumb(row: BackgroundLocationRow): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BG_LOCATION_QUEUE_KEY);
    const list: BackgroundLocationRow[] = raw ? JSON.parse(raw) : [];
    list.push(row);
    await AsyncStorage.setItem(
      BG_LOCATION_QUEUE_KEY,
      JSON.stringify(list.slice(-MAX_QUEUED_BREADCRUMBS))
    );
  } catch (error) {
    console.warn('[bgLocation] failed to buffer breadcrumb', error);
  }
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[bgLocation] task error', error.message);
    return;
  }

  const shiftId = await getActiveShiftId();
  if (!shiftId) return;

  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations;
  if (!locations || locations.length === 0) return;

  // Only persist the freshest fix from each batch to keep write volume sane.
  const fix = locations[locations.length - 1];
  const row: BackgroundLocationRow = {
    shift_id: shiftId,
    event_type: 'location',
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    created_at: new Date(fix.timestamp || Date.now()).toISOString(),
    metadata: {
      source: 'background_tracking',
      accuracy: fix.coords.accuracy ?? null,
      heading: fix.coords.heading ?? null,
      speed: fix.coords.speed ?? null,
    },
  };

  try {
    const { error: insertError } = await supabase.from('shift_events').insert(row);
    if (insertError) throw insertError;
  } catch (insertError) {
    console.warn('[bgLocation] insert failed, buffering offline', insertError);
    await bufferBreadcrumb(row);
  }
});

/** Requests foreground then background ("Always") location permission. */
export async function requestTrackingPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  if (Platform.OS === 'web') return { foreground: false, background: false };

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { foreground: false, background: false };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: background.status === 'granted' };
}

/**
 * Starts OS-level background location updates for an active shift. Idempotent —
 * safe to call repeatedly. Requires the user to grant "Always" location access;
 * without it the foreground tracking on ActiveShiftScreen still works.
 */
export async function startBackgroundLocationTracking(shiftId: string): Promise<void> {
  if (Platform.OS === 'web' || !shiftId) return;

  await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, shiftId);

  const perms = await requestTrackingPermissions();
  if (!perms.background) {
    console.warn('[bgLocation] background permission not granted; background tracking unavailable');
    return;
  }

  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
    () => false
  );
  if (alreadyRunning) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,
    distanceInterval: 50,
    deferredUpdatesInterval: 60_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: 'TransLine is tracking your shift',
      notificationBody: 'Your location is recorded while you are on shift.',
      notificationColor: '#C62828',
    },
  });
  console.log('[bgLocation] background location updates started', { shiftId });
}

/** Stops background location updates and clears the stored active shift id. */
export async function stopBackgroundLocationTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
      () => false
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[bgLocation] background location updates stopped');
    }
  } finally {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
  }
}

/** Flushes breadcrumbs that were buffered while the background task was offline. */
export async function drainBackgroundLocationQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BG_LOCATION_QUEUE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as BackgroundLocationRow[];
    if (!Array.isArray(list) || list.length === 0) return;

    const remaining: BackgroundLocationRow[] = [];
    for (const row of list) {
      const { error } = await supabase.from('shift_events').insert(row);
      if (error) remaining.push(row);
    }
    await AsyncStorage.setItem(BG_LOCATION_QUEUE_KEY, JSON.stringify(remaining));
  } catch (error) {
    console.warn('[bgLocation] failed to drain breadcrumb queue', error);
  }
}
