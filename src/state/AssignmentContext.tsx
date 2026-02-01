import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AssignmentStatus = 'loading' | 'assigned' | 'unassigned' | 'error';

export interface VehicleAssignment {
  vehicle_id: string;
  unassigned_at: string | null;
  created_at: string;
}

export interface AssignedVehicle {
  id: string;
  registration?: string | null;
  name?: string | null;
  type?: string | null;
  depot?: string | null;
}

interface AssignmentContextValue {
  status: AssignmentStatus;
  assignment: VehicleAssignment | null;
  vehicle: AssignedVehicle | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const AssignmentContext = createContext<AssignmentContextValue | undefined>(undefined);

export function AssignmentProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AssignmentStatus>('loading');
  const [assignment, setAssignment] = useState<VehicleAssignment | null>(null);
  const [vehicle, setVehicle] = useState<AssignedVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;
      console.log('[Assignment] auth user', userId);
      if (!userId) {
        setAssignment(null);
        setVehicle(null);
        setStatus('unassigned');
        return;
      }

      const { data: assignmentRow, error: assignmentError } = await supabase
        .from('vehicle_assignments')
        .select('vehicle_id, unassigned_at, created_at')
        .eq('driver_id', userId)
        .is('unassigned_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[Assignment] assignment row', assignmentRow, assignmentError);

      if (assignmentError) {
        setError(assignmentError.message);
        setStatus('error');
        return;
      }

      if (!assignmentRow) {
        setAssignment(null);
        setVehicle(null);
        setStatus('unassigned');
        return;
      }

      setAssignment(assignmentRow);

      const { data: vehicleRow, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, registration, name, type, depot')
        .eq('id', assignmentRow.vehicle_id)
        .maybeSingle();

      console.log('[Assignment] vehicle row', vehicleRow, vehicleError);

      if (vehicleError) {
        setError(vehicleError.message);
        setVehicle(null);
        setStatus('error');
        return;
      }

      setVehicle(vehicleRow ?? null);
      setStatus('assigned');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assignment.';
      setError(message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchAssignment();
    const { data } = supabase.auth.onAuthStateChange(() => {
      fetchAssignment();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [fetchAssignment]);

  return (
    <AssignmentContext.Provider
      value={{
        status,
        assignment,
        vehicle,
        error,
        refresh: fetchAssignment,
      }}
    >
      {children}
    </AssignmentContext.Provider>
  );
}

export function useActiveAssignment() {
  const context = useContext(AssignmentContext);
  if (!context) {
    throw new Error('useActiveAssignment must be used within AssignmentProvider');
  }
  return context;
}
