import { supabase } from './supabase';
import { networkMonitor } from './networkMonitor';
import { offlineQueue } from './offlineQueue';

export interface Shift {
  id: string;
  driver_id: string;
  vehicle_id: string;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  start_odometer: number | null;
  end_odometer: number | null;
  created_at: string;
}

/**
 * Create a new shift for the driver
 */
export async function createShift(driverId: string, vehicleId: string): Promise<{ shift: Shift | null; error?: string }> {
  try {
    const isOnline = await networkMonitor.isOnline();

    const payload = {
      driver_id: driverId,
      vehicle_id: vehicleId,
      started_at: new Date().toISOString(),
      status: 'active',
    };

    if (!isOnline) {
      console.log('[Shift] Offline: queuing shift creation');
      await offlineQueue.addEvent('START_SHIFT', payload);
      // Return a temporary ID
      return {
        shift: {
          id: `temp-${Date.now()}`,
          ...payload,
          created_at: new Date().toISOString(),
        } as Shift,
      };
    }

    const { data, error } = await supabase.from('shifts').insert([payload]).select().single();

    if (error) {
      console.error('[Shift] Error creating shift:', error);
      return { shift: null, error: error.message };
    }

    console.log('[Shift] Created shift:', data?.id);
    return { shift: data as Shift };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { shift: null, error: message };
  }
}

/**
 * Get the currently active shift for a driver
 */
export async function getActiveShift(driverId: string): Promise<{ shift: Shift | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('driver_id', driverId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Shift] Error fetching active shift:', error);
      return { shift: null, error: error.message };
    }

    console.log('[Shift] Active shift:', data?.id ?? 'none');
    return { shift: data as Shift | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { shift: null, error: message };
  }
}

/**
 * End a shift and capture odometer reading
 */
export async function endShift(
  shiftId: string,
  endOdometerReading: number,
  endOdometerPhotoUri?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const isOnline = await networkMonitor.isOnline();

    const payload = {
      id: shiftId,
      ended_at: new Date().toISOString(),
      status: 'completed',
      end_odometer: endOdometerReading,
    };

    if (!isOnline) {
      console.log('[Shift] Offline: queuing shift end');
      await offlineQueue.addEvent('END_SHIFT', payload);
      return { success: true };
    }

    const { error } = await supabase.from('shifts').update(payload).eq('id', shiftId);

    if (error) {
      console.error('[Shift] Error ending shift:', error);
      return { success: false, error: error.message };
    }

    console.log('[Shift] Ended shift:', shiftId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Start a break during a shift
 */
export async function startBreak(shiftId: string): Promise<{ breakId: string | null; error?: string }> {
  try {
    const isOnline = await networkMonitor.isOnline();

    const payload = {
      shift_id: shiftId,
      start_at: new Date().toISOString(),
      type: 'rest',
    };

    if (!isOnline) {
      console.log('[Break] Offline: queuing break start');
      await offlineQueue.addEvent('BREAK_START', payload);
      return { breakId: `temp-${Date.now()}` };
    }

    const { data, error } = await supabase.from('break_logs').insert([payload]).select('id').single();

    if (error) {
      console.error('[Break] Error starting break:', error);
      return { breakId: null, error: error.message };
    }

    console.log('[Break] Started break:', data?.id);
    return { breakId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { breakId: null, error: message };
  }
}

/**
 * End an active break
 */
export async function endBreak(breakId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const isOnline = await networkMonitor.isOnline();

    const payload = {
      id: breakId,
      end_at: new Date().toISOString(),
    };

    if (!isOnline) {
      console.log('[Break] Offline: queuing break end');
      await offlineQueue.addEvent('BREAK_END', payload);
      return { success: true };
    }

    const { error } = await supabase.from('break_logs').update(payload).eq('id', breakId);

    if (error) {
      console.error('[Break] Error ending break:', error);
      return { success: false, error: error.message };
    }

    console.log('[Break] Ended break:', breakId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Record an odometer reading
 */
export async function recordOdometerReading(
  shiftId: string,
  vehicleId: string,
  reading: number,
  photoUri?: string,
  kind: 'start' | 'mid' | 'end' = 'mid'
): Promise<{ logId: string | null; error?: string }> {
  try {
    const isOnline = await networkMonitor.isOnline();

    const payload = {
      shift_id: shiftId,
      vehicle_id: vehicleId,
      reading,
      photo_path: photoUri || null,
      kind,
      recorded_at: new Date().toISOString(),
    };

    if (!isOnline) {
      console.log('[Odometer] Offline: queuing odometer record');
      await offlineQueue.addEvent(kind === 'start' ? 'START_ODOMETER' : kind === 'end' ? 'END_ODOMETER' : 'ODOMETER_MID', payload);
      return { logId: `temp-${Date.now()}` };
    }

    const { data, error } = await supabase
      .from('odometer_logs')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      console.error('[Odometer] Error recording reading:', error);
      return { logId: null, error: error.message };
    }

    console.log('[Odometer] Recorded reading:', data?.id);
    return { logId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { logId: null, error: message };
  }
}

/**
 * Record a fuel log entry
 */
export async function recordFuelLog(
  shiftId: string,
  vehicleId: string,
  liters: number,
  cost?: number,
  location?: string,
  photoUri?: string
): Promise<{ logId: string | null; error?: string }> {
  try {
    const isOnline = await networkMonitor.isOnline();

    const payload = {
      shift_id: shiftId,
      vehicle_id: vehicleId,
      liters,
      cost: cost || null,
      location: location || null,
      photo_path: photoUri || null,
      created_at: new Date().toISOString(),
    };

    if (!isOnline) {
      console.log('[Fuel] Offline: queuing fuel log');
      await offlineQueue.addEvent('FUEL_LOG_SUBMIT', payload);
      return { logId: `temp-${Date.now()}` };
    }

    const { data, error } = await supabase
      .from('fuel_logs')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      console.error('[Fuel] Error recording fuel log:', error);
      return { logId: null, error: error.message };
    }

    console.log('[Fuel] Recorded fuel log:', data?.id);
    return { logId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { logId: null, error: message };
  }
}
