import { supabase } from './supabase';

export interface AssignedVehicleInfo {
  id: string;
  registration: string | null;
  rego: string | null;
  plate_number: string | null;
  type: string | null;
  depot: string | null;
  depot_name?: string | null;
  assigned_driver_id: string | null;
  assigned_at?: string;
  [key: string]: any; // Allow extra fields from DB
}

/**
 * Get a display label for a vehicle from available fields
 */
export function getVehicleLabel(vehicle: AssignedVehicleInfo | null): string {
  if (!vehicle) return 'Unknown';
  // Try common registration fields in order
  if (vehicle.registration) return vehicle.registration;
  if (vehicle.rego) return vehicle.rego;
  if (vehicle.plate_number) return vehicle.plate_number;
  // Fallback to ID
  return `Vehicle ${vehicle.id.slice(0, 6)}`;
}

/**
 * Fetch the currently assigned vehicle for the authenticated user.
 * Single source of truth: vehicles.assigned_driver_id = auth.uid()
 *
 * Returns: { vehicle, error }
 *   - vehicle: null if no assignment found
 *   - error: optional error message
 */
export async function getAssignedVehicleForCurrentUser(): Promise<{
  vehicle: AssignedVehicleInfo | null;
  assignmentSource: 'vehicles.assigned_driver_id' | null;
  error?: string;
}> {
  try {
    // Get current session
    const { data: sessionData } = await supabase.auth.getSession();
    const authUserId = sessionData?.session?.user?.id;

    if (!authUserId) {
      console.log('[Assignment] ✗ No authenticated user');
      return { vehicle: null, assignmentSource: null };
    }

    console.log('[Assignment] Auth user ID:', authUserId);

    // SINGLE SOURCE OF TRUTH: vehicles.assigned_driver_id = auth.uid()
    console.log('[Assignment] Querying vehicles WHERE assigned_driver_id = auth.uid()');
    const { data: vehicle, error: err } = await supabase
      .from('vehicles')
      .select('id, registration, rego, plate_number, type, depot, assigned_driver_id, assigned_at')
      .eq('assigned_driver_id', authUserId)
      .limit(1)
      .maybeSingle();

    if (err) {
      const errorMsg = `Failed to fetch assigned vehicle: ${err.message}`;
      console.error('[Assignment] ✗', errorMsg);
      return { vehicle: null, assignmentSource: null, error: errorMsg };
    }

    if (vehicle) {
      const label = getVehicleLabel(vehicle);
      console.log('[Assignment] ✓ Found assigned vehicle:', { id: vehicle.id, label });
      return { vehicle, assignmentSource: 'vehicles.assigned_driver_id' };
    }

    console.log('[Assignment] ✗ No vehicle assigned to this user. Please contact admin.');
    return { vehicle: null, assignmentSource: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Assignment] Exception:', message);
    return { vehicle: null, assignmentSource: null, error: message };
  }
}
