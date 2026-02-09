import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getAssignedVehicleForCurrentUser, getVehicleLabel } from '../lib/assignment';

export type AssignmentStatus = 'loading' | 'assigned' | 'unassigned' | 'error';

export interface VehicleAssignment {
  vehicle_id: string;
  unassigned_at: string | null;
  created_at: string;
}

export interface AssignedVehicle {
  id: string;
  registration?: string | null;
  rego?: string | null;
  plate_number?: string | null;
  type?: string | null;
  depot?: string | null;
  depot_name?: string | null;
  label?: string; // Display label (from registration/rego/plate or vehicle ID)
}

interface AssignmentContextValue {
  status: AssignmentStatus;
  assignment: VehicleAssignment | null;
  vehicle: AssignedVehicle | null;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

const AssignmentContext = createContext<AssignmentContextValue | undefined>(undefined);

export function AssignmentProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AssignmentStatus>('loading');
  const [assignment, setAssignment] = useState<VehicleAssignment | null>(null);
  const [vehicle, setVehicle] = useState<AssignedVehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastFetchAtRef = useRef<number>(0);
  const FETCH_DEBOUNCE_MS = 2000; // Don't re-fetch more than once per 2 seconds

  const fetchAssignment = useCallback(async (force = false) => {
    const now = Date.now();

    // Debounce: skip if fetched recently (unless forced)
    if (!force && now - lastFetchAtRef.current < FETCH_DEBOUNCE_MS) {
      console.log(
        '[Assignment] Skipping fetch (debounced, last fetch',
        now - lastFetchAtRef.current,
        'ms ago)'
      );
      return;
    }

    lastFetchAtRef.current = now;
    setStatus('loading');
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;
      console.log('[Assignment] Auth user:', userId);
      if (!userId) {
        setAssignment(null);
        setVehicle(null);
        setStatus('unassigned');
        return;
      }

      // Use single source of truth for assignment: vehicles.assigned_driver_id = auth.uid()
      const { vehicle, assignmentSource, error: resolveError } = await getAssignedVehicleForCurrentUser();

      if (resolveError) {
        console.error('[Assignment] Resolution error:', resolveError);
        setError(resolveError);
        setStatus('error');
        setAssignment(null);
        setVehicle(null);
        return;
      }

      console.log('[Assignment] Resolved vehicle:', vehicle?.id, 'via:', assignmentSource);

      if (!vehicle) {
        setAssignment(null);
        setVehicle(null);
        setStatus('unassigned');
        return;
      }

      // Convert to expected format
      setVehicle({
        id: vehicle.id,
        registration: vehicle.registration ?? null,
        rego: vehicle.rego ?? null,
        plate_number: vehicle.plate_number ?? null,
        type: vehicle.type ?? null,
        depot: vehicle.depot ?? vehicle.depot_name ?? null,
        depot_name: vehicle.depot_name ?? null,
        label: getVehicleLabel(vehicle),
      });

      // Set a synthetic assignment record
      setAssignment({
        vehicle_id: vehicle.id,
        unassigned_at: null,
        created_at: new Date().toISOString(),
      });

      setStatus('assigned');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assignment.';
      console.error('[Assignment] Error:', message);
      setError(message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // Force initial fetch on mount
    fetchAssignment(true);
    
    // Re-fetch on auth state change (without debounce)
    const { data } = supabase.auth.onAuthStateChange(() => {
      fetchAssignment(true);
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
