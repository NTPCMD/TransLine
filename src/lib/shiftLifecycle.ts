import { supabase } from './supabase';

function coerceShiftId(data: unknown): string | null {
  if (typeof data === 'string' && data.trim().length > 0) {
    return data;
  }

  if (data && typeof data === 'object') {
    const maybeId = 'id' in data ? data.id : null;
    if (typeof maybeId === 'string' && maybeId.trim().length > 0) {
      return maybeId;
    }
  }

  return null;
}

/**
 * Start a shift via RPC. Returns the new shift UUID.
 */
export async function startShift(params: {
  p_driver_id: string;
  p_start_lat?: number | null;
  p_start_lng?: number | null;
  p_checklist?: Record<string, unknown> | null;
  p_device_info?: Record<string, unknown> | null;
}): Promise<{ shiftId: string | null; error?: string }> {
  console.log('[shiftLifecycle] start_shift RPC request', {
    p_driver_id: params.p_driver_id,
    p_start_lat: params.p_start_lat ?? null,
    p_start_lng: params.p_start_lng ?? null,
  });
  const { data, error } = await supabase.rpc('start_shift', params);
  if (error) {
    console.error('[shiftLifecycle] start_shift RPC error:', error.message);
    return { shiftId: null, error: error.message };
  }

  const shiftId = coerceShiftId(data);
  if (!shiftId) {
    console.error('[shiftLifecycle] start_shift RPC returned invalid payload', { data });
    return { shiftId: null, error: 'start_shift returned an invalid shift id.' };
  }

  return { shiftId };
}

/**
 * End an active shift via RPC.
 */
export async function endShift(params: {
  p_shift_id: string;
  p_end_lat?: number | null;
  p_end_lng?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('end_shift', params);
  if (error) {
    console.error('[shiftLifecycle] end_shift RPC error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Log an idle event for a shift via RPC.
 */
export async function logIdleEvent(params: {
  p_shift_id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('log_idle_event', params);
  if (error) {
    console.error('[shiftLifecycle] log_idle_event RPC error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Start a break via RPC.
 */
export async function startBreak(params: {
  p_shift_id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('start_break', params);
  if (error) {
    console.error('[shiftLifecycle] start_break RPC error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * End a break via RPC.
 */
export async function endBreak(params: {
  p_shift_id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('end_break', params);
  if (error) {
    console.error('[shiftLifecycle] end_break RPC error:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
