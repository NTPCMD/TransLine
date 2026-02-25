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

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

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
