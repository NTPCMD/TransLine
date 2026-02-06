import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { networkMonitor } from './networkMonitor';
import { offlineQueue } from './offlineQueue';

export interface GPSPoint {
  shift_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
  recorded_at: string;
}

export interface StopEvent {
  shift_id: string;
  started_at: string;
  ended_at: string | null;
  lat: number;
  lng: number;
  duration_seconds: number;
}

export type GpsFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export async function getGpsFix(): Promise<GpsFix> {
  if (Platform.OS === 'web') {
    return await new Promise<GpsFix>((resolve, reject) => {
      const geolocation = (globalThis as any).navigator?.geolocation;
      if (!geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('Location permission denied');
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

let locationSubscription: Location.LocationSubscription | null = null;
let currentStopEvent: Partial<StopEvent> | null = null;
let stationaryCount = 0;
const STATIONARY_THRESHOLD = 120; // 2 minutes in seconds
const UPDATE_INTERVAL = 10000; // 10 seconds

/**
 * Request location permissions
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const foreground = await Location.requestForegroundPermissionsAsync();
    const background = await Location.requestBackgroundPermissionsAsync();
    return foreground.granted && background.granted;
  } catch (error) {
    console.error('[GPS] Permission error:', error);
    return false;
  }
}

/**
 * Start GPS tracking for a shift
 */
export async function startTracking(shiftId: string): Promise<void> {
  try {
    console.log('[GPS] Starting tracking for shift:', shiftId);
    const permissions = await requestLocationPermissions();

    if (!permissions) {
      throw new Error('Location permissions not granted');
    }

    // Start watching location
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: UPDATE_INTERVAL,
        distanceInterval: 5, // meters
      },
      (location) => {
        handleLocationUpdate(location, shiftId);
      }
    );
  } catch (error) {
    console.error('[GPS] Error starting tracking:', error);
  }
}

/**
 * Stop GPS tracking
 */
export async function stopTracking(): Promise<void> {
  try {
    console.log('[GPS] Stopping tracking');
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }

    // End any active stop event
    if (currentStopEvent && currentStopEvent.shift_id) {
      await endStopEvent(currentStopEvent.shift_id);
    }
  } catch (error) {
    console.error('[GPS] Error stopping tracking:', error);
  }
}

/**
 * Handle location update from expo-location
 */
async function handleLocationUpdate(location: Location.LocationObject, shiftId: string): Promise<void> {
  try {
    const { coords } = location;
    const speed = coords.speed || 0; // m/s, convert to km/h
    const speedKmh = (speed * 3.6).toFixed(1);

    console.log('[GPS] Update: speed=' + speedKmh + 'km/h lat=' + coords.latitude.toFixed(4) + ' lng=' + coords.longitude.toFixed(4));

    // Record GPS point
    await recordGPSPoint(shiftId, coords.latitude, coords.longitude, parseFloat(speedKmh), coords.heading || 0, coords.accuracy || 0);

    // Detect stops: speed < 5 km/h
    const isStationary = parseFloat(speedKmh) < 5;

    if (isStationary) {
      stationaryCount++;

      // Start stop event if not already started
      if (!currentStopEvent || !currentStopEvent.shift_id) {
        currentStopEvent = {
          shift_id: shiftId,
          started_at: new Date().toISOString(),
          lat: coords.latitude,
          lng: coords.longitude,
          duration_seconds: 0,
        };
        console.log('[GPS] Stop event started at:', currentStopEvent.started_at);
      }

      // Check if stop duration exceeds threshold (2 minutes = 12 updates @ 10sec interval)
      if (stationaryCount >= STATIONARY_THRESHOLD / UPDATE_INTERVAL) {
        console.log('[GPS] Stop event threshold reached (2+ minutes stationary)');
      }
    } else {
      // Vehicle is moving again
      if (stationaryCount > 0 && currentStopEvent && currentStopEvent.shift_id) {
        // Vehicle was stationary but is now moving
        if (stationaryCount >= STATIONARY_THRESHOLD / UPDATE_INTERVAL) {
          // Record the stop event if it was significant
          await recordStopEvent(currentStopEvent.shift_id, currentStopEvent as any);
        }
        currentStopEvent = null;
      }
      stationaryCount = 0;
    }
  } catch (error) {
    console.error('[GPS] Error handling location update:', error);
  }
}

/**
 * Record a GPS point to the database
 */
export async function recordGPSPoint(
  shiftId: string,
  lat: number,
  lng: number,
  speed: number,
  heading: number,
  accuracy: number
): Promise<void> {
  try {
    const isOnline = await networkMonitor.isOnline();
    const point = {
      shift_id: shiftId,
      lat,
      lng,
      speed,
      heading,
      accuracy,
      recorded_at: new Date().toISOString(),
    };

    if (!isOnline) {
      // Queue for later
      await offlineQueue.addEvent('GPS_POINT', point);
      return;
    }

    // For online mode, batch points (optional optimization)
    const { error } = await supabase.from('gps_points').insert([point]);

    if (error) {
      console.error('[GPS] Error recording point:', error);
    }
  } catch (error) {
    console.error('[GPS] Exception recording point:', error);
  }
}

/**
 * Record a stop event to the database
 */
export async function recordStopEvent(shiftId: string, stopEvent: StopEvent): Promise<void> {
  try {
    const isOnline = await networkMonitor.isOnline();
    const payload = {
      shift_id: shiftId,
      started_at: stopEvent.started_at,
      ended_at: new Date().toISOString(),
      lat: stopEvent.lat,
      lng: stopEvent.lng,
      duration_seconds: Math.round((new Date(stopEvent.ended_at || new Date()).getTime() - new Date(stopEvent.started_at).getTime()) / 1000),
    };

    if (!isOnline) {
      await offlineQueue.addEvent('STOP_EVENT', payload);
      return;
    }

    const { error } = await supabase.from('stop_events').insert([payload]);

    if (error) {
      console.error('[GPS] Error recording stop event:', error);
    }

    console.log('[GPS] Recorded stop event:', payload.duration_seconds + 's');
  } catch (error) {
    console.error('[GPS] Exception recording stop event:', error);
  }
}

/**
 * End the current stop event (called on shift end)
 */
export async function endStopEvent(shiftId: string): Promise<void> {
  if (currentStopEvent && currentStopEvent.shift_id === shiftId) {
    currentStopEvent.ended_at = new Date().toISOString();
    await recordStopEvent(shiftId, currentStopEvent as StopEvent);
    currentStopEvent = null;
  }
}

/**
 * Get GPS stats for a shift
 */
export async function getShiftGPSStats(shiftId: string): Promise<{
  pointCount: number;
  stopCount: number;
  avgSpeed: number;
  error?: string;
}> {
  try {
    const { count: pointCount, error: pointError } = await supabase
      .from('gps_points')
      .select('*', { count: 'exact', head: true })
      .eq('shift_id', shiftId);

    const { count: stopCount, error: stopError } = await supabase
      .from('stop_events')
      .select('*', { count: 'exact', head: true })
      .eq('shift_id', shiftId);

    if (pointError || stopError) {
      const error = pointError || stopError;
      return { pointCount: 0, stopCount: 0, avgSpeed: 0, error: error?.message };
    }

    return { pointCount: pointCount || 0, stopCount: stopCount || 0, avgSpeed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { pointCount: 0, stopCount: 0, avgSpeed: 0, error: message };
  }
}
