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

    const normalized = error.message.toLowerCase();
    if (normalized.includes('driver mismatch')) {
      const candidateIds: string[] = [];

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError) {
        const authUserId = userData?.user?.id ?? null;
        if (authUserId) {
          candidateIds.push(authUserId);

          const driverLookups = await Promise.all([
            supabase.from('drivers').select('id').eq('user_id', authUserId).limit(1).maybeSingle(),
            supabase.from('drivers').select('id').eq('profile_id', authUserId).limit(1).maybeSingle(),
            supabase.from('drivers').select('id').eq('id', authUserId).limit(1).maybeSingle(),
          ]);

          for (const lookup of driverLookups) {
            const id = lookup.data?.id ?? null;
            if (id) {
              candidateIds.push(id);
            }
          }
        }
      }

      const dedupedCandidates = candidateIds.filter(
        (value, index, arr) => Boolean(value) && arr.indexOf(value) === index && value !== params.p_driver_id
      );

      for (const candidateId of dedupedCandidates) {
        console.log('[shiftLifecycle] retry start_shift with candidate driver id', {
          previousDriverId: params.p_driver_id,
          candidateDriverId: candidateId,
        });

        const retry = await supabase.rpc('start_shift', {
          ...params,
          p_driver_id: candidateId,
        });

        if (!retry.error && retry.data) {
          return { shiftId: retry.data as string };
        }

        if (retry.error) {
          console.warn('[shiftLifecycle] retry start_shift failed', {
            candidateDriverId: candidateId,
            message: retry.error.message,
          });
        }
      }
    }

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
