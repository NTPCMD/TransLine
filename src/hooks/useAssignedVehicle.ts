import { useCallback, useEffect, useState } from 'react';
import {
  getAssignedVehicleForDriver,
  type ActiveVehicleAssignmentRecord,
  type AssignedVehicleInfo,
} from '../lib/assignment';

export type AssignedVehicleStatus = 'loading' | 'assigned' | 'unassigned' | 'error';

export function useAssignedVehicle(driverId: string | null, enabled = true) {
  const [status, setStatus] = useState<AssignedVehicleStatus>(enabled ? 'loading' : 'unassigned');
  const [assignment, setAssignment] = useState<ActiveVehicleAssignmentRecord | null>(null);
  const [vehicle, setVehicle] = useState<AssignedVehicleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (_force = false) => {
      if (!enabled) {
        setStatus('loading');
        return;
      }

      if (!driverId) {
        setAssignment(null);
        setVehicle(null);
        setError(null);
        setStatus('unassigned');
        return;
      }

      setStatus('loading');
      setError(null);

      const result = await getAssignedVehicleForDriver(driverId);

      if (result.error) {
        setAssignment(null);
        setVehicle(null);
        setError(result.error);
        setStatus('error');
        return;
      }

      setAssignment(result.assignment ?? null);
      setVehicle(result.vehicle ?? null);
      setStatus(result.vehicle ? 'assigned' : 'unassigned');
    },
    [driverId, enabled]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  return {
    status,
    assignment,
    vehicle,
    error,
    refresh,
  };
}
