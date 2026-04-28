import { supabase } from './supabase';

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
  return { shiftId: data as string };
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
