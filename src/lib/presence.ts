import { supabase } from './supabase';

/**
 * Mark a driver as online in driver_presence.
 */
export async function setDriverOnline(
  driverId: string,
  deviceId: string,
  shiftId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('driver_presence').upsert(
    {
      driver_id: driverId,
      device_id: deviceId,
      shift_id: shiftId ?? null,
      status: 'online',
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'driver_id' }
  );
  if (error) {
    console.error('[presence] setDriverOnline error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Mark a driver as offline in driver_presence.
 */
export async function setDriverOffline(
  driverId: string,
  deviceId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('driver_presence').upsert(
    {
      driver_id: driverId,
      device_id: deviceId,
      status: 'offline',
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'driver_id' }
  );
  if (error) {
    console.error('[presence] setDriverOffline error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
