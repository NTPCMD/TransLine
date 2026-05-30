import React, { createContext, useContext } from 'react';
import { useAssignedVehicle } from '../hooks/useAssignedVehicle';
import { getVehicleLabel } from '../lib/assignment';
import { useDriver } from './DriverContext';

export type AssignmentStatus = 'loading' | 'assigned' | 'unassigned' | 'error';

export interface VehicleAssignment {
  vehicle_id: string;
  unassigned_at: string | null;
  created_at: string;
}

export interface AssignedVehicle {
  id: string;
  rego?: string | null;
  plate_number?: string | null;
  make?: string | null;
  model?: string | null;
  type?: string | null;
  depot?: string | null;
  depot_name?: string | null;
  label?: string;
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
  const { currentDriver, loading } = useDriver();
  const assignmentState = useAssignedVehicle(currentDriver?.id ?? null, !loading);

  const assignment = assignmentState.assignment
    ? {
        vehicle_id: assignmentState.assignment.vehicle_id,
        unassigned_at: assignmentState.assignment.unassigned_at ?? null,
        created_at: assignmentState.assignment.assigned_at ?? new Date().toISOString(),
      }
    : null;

  const vehicle = assignmentState.vehicle
    ? {
        id: assignmentState.vehicle.id,
        rego: assignmentState.vehicle.rego ?? null,
        plate_number: assignmentState.vehicle.plate_number ?? null,
        make: assignmentState.vehicle.make ?? null,
        model: assignmentState.vehicle.model ?? null,
        type: assignmentState.vehicle.type ?? null,
        depot: assignmentState.vehicle.depot ?? assignmentState.vehicle.depot_name ?? null,
        depot_name: assignmentState.vehicle.depot_name ?? null,
        label: getVehicleLabel(assignmentState.vehicle),
      }
    : null;

  return (
    <AssignmentContext.Provider
      value={{
        status: assignmentState.status,
        assignment,
        vehicle,
        error: assignmentState.error,
        refresh: assignmentState.refresh,
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
