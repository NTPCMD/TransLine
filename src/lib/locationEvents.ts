import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './supabase';

export type GpsFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

/**
 * Get a single GPS fix from the device.
 */
export async function getGpsFix(): Promise<GpsFix> {
  if (Platform.OS === 'web') {
    return await new Promise<GpsFix>((resolve, reject) => {
      const geolocation = (globalThis as any).navigator?.geolocation;
      if (!geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      geolocation.getCurrentPosition(
        (pos: GeolocationPosition) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          }),
        (err: GeolocationPositionError) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('Location permission denied');
  }

  // Fast path: reuse a recently cached fix. Shift tracking keeps this fresh, so
  // it's near-instant and — unlike a fresh high-accuracy lock — works indoors
  // instead of hanging while it waits for satellites.
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        accuracy: lastKnown.coords.accuracy ?? null,
      };
    }
  } catch {
    // fall through to a fresh fix
  }

  // Otherwise request a fresh fix, but cap the wait so it can never hang.
  const pos = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Location request timed out')), 8000)
    ),
  ]);

  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

/**
 * Log a location event into shift_events for the given shift.
 */
export async function logLocationEvent(
  shiftId: string,
  latitude: number,
  longitude: number
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('shift_events').insert({
    shift_id: shiftId,
    event_type: 'location',
    latitude,
    longitude,
  });
  if (error) {
    console.error('[locationEvents] logLocationEvent error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
