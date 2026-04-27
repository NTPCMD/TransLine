import { fetchDriverContext } from './driverSession';
import { supabase } from './supabase';

export interface ActiveVehicleAssignmentRecord {
  id?: string;
  driver_id?: string | null;
  vehicle_id: string;
  assigned_at?: string | null;
  unassigned_at: string | null;
  [key: string]: any;
}

export interface AssignedVehicleInfo {
  id: string;
  rego: string | null;
  make: string | null;
  model: string | null;
  type: string | null;
  depot: string | null;
  status?: string | null;
  is_active?: boolean | null;
  assigned_driver_id?: string | null;
  assigned_at?: string | null;
  [key: string]: any;
}

/**
 * Get a display label for a vehicle from available fields.
 */
export function getVehicleLabel(vehicle: AssignedVehicleInfo | null): string {
  if (!vehicle) return 'Unknown';
  // Canonical vehicle display field from live schema.
  if (vehicle.rego) return vehicle.rego;
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  if (makeModel) return makeModel;
  return `Vehicle ${vehicle.id.slice(0, 6)}`;
}

async function fetchActiveAssignmentByDriverId(driverId: string): Promise<{
  assignment: ActiveVehicleAssignmentRecord | null;
  vehicle: AssignedVehicleInfo | null;
  assignmentSource: 'vehicle_assignments' | null;
  error?: string;
}> {
  const { data, error } = await supabase
    .from('vehicle_assignments')
    .select('*')
    .eq('driver_id', driverId)
    .is('unassigned_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('ASSIGNMENT driver.id =', driverId);
  console.log('ASSIGNMENT result =', data);
  console.log('ASSIGNMENT error =', error);

  if (error) {
    const normalizedMessage = error.message.toLowerCase();
    if (
      normalizedMessage.includes('0 rows') ||
      normalizedMessage.includes('multiple') ||
      normalizedMessage.includes('cannot coerce') ||
      normalizedMessage.includes('single json object')
    ) {
      return {
        assignment: null,
        vehicle: null,
        assignmentSource: null,
      };
    }

    const errorMsg = `Failed to fetch vehicle assignment: ${error.message}`;
    console.error('[Assignment] ✗', errorMsg, { driverId });
    return {
      assignment: null,
      vehicle: null,
      assignmentSource: null,
      error: errorMsg,
    };
  }

  let vehicle: AssignedVehicleInfo | null = null;

  if ((data as any)?.vehicle_id) {
    const { data: vehicleData, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, rego, make, model, status, is_active')
      .eq('id', (data as any).vehicle_id)
      .limit(1)
      .maybeSingle();

    console.log('VEHICLE FETCH =', vehicleData);

    if (vehicleError) {
      const normalizedMessage = vehicleError.message.toLowerCase();
      if (!normalizedMessage.includes('0 rows')) {
        const errorMsg = `Failed to fetch vehicle: ${vehicleError.message}`;
        console.error('[Assignment] ✗', errorMsg, { vehicleId: (data as any).vehicle_id });
        return {
          assignment: null,
          vehicle: null,
          assignmentSource: null,
          error: errorMsg,
        };
      }
    }

    if (vehicleData) {
      vehicle = {
        id: vehicleData.id,
        rego: vehicleData.rego ?? null,
        make: vehicleData.make ?? null,
        model: vehicleData.model ?? null,
        type: null,
        depot: null,
        status: vehicleData.status ?? null,
        is_active: typeof vehicleData.is_active === 'boolean' ? vehicleData.is_active : null,
      } as AssignedVehicleInfo;
    }
  }

  return {
    assignment: data
      ? {
          id: (data as any).id,
          driver_id: (data as any).driver_id ?? null,
          vehicle_id: (data as any).vehicle_id,
          assigned_at: (data as any).assigned_at ?? null,
          unassigned_at: (data as any).unassigned_at ?? null,
        }
      : null,
    vehicle,
    assignmentSource: vehicle ? 'vehicle_assignments' : null,
  };
}

export async function getAssignedVehicleForDriver(driverId: string): Promise<{
  assignment: ActiveVehicleAssignmentRecord | null;
  vehicle: AssignedVehicleInfo | null;
  assignmentSource: 'vehicle_assignments' | null;
  error?: string;
}> {
  if (!driverId) {
    return { assignment: null, vehicle: null, assignmentSource: null };
  }

  return fetchActiveAssignmentByDriverId(driverId);
}

/**
 * Fetch the active vehicle assignment for the authenticated user.
 * Source of truth: vehicle_assignments where unassigned_at IS NULL.
 */
export async function getAssignedVehicleForCurrentUser(): Promise<{
  assignment: ActiveVehicleAssignmentRecord | null;
  vehicle: AssignedVehicleInfo | null;
  assignmentSource: 'vehicle_assignments' | null;
  error?: string;
}> {
  try {
    const { driver, error } = await fetchDriverContext();

    if (error && !driver) {
      return {
        assignment: null,
        vehicle: null,
        assignmentSource: null,
        error,
      };
    }

    if (!driver?.id) {
      return {
        assignment: null,
        vehicle: null,
        assignmentSource: null,
        error: 'Driver profile not found for assignment lookup.',
      };
    }

    const result = await fetchActiveAssignmentByDriverId(driver.id);

    if (result.vehicle) {
      console.log('[Assignment] ✓ Active assignment found', {
        driverId: driver.id,
        vehicleId: result.vehicle.id,
        rego: getVehicleLabel(result.vehicle),
      });
    } else {
      console.log('[Assignment] ✗ No active vehicle assignment found', {
        driverId: driver.id,
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Assignment] Exception:', message);
    return { assignment: null, vehicle: null, assignmentSource: null, error: message };
  }
}
