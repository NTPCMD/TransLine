import React, { createContext, useContext, type ReactNode } from 'react';
import { useAssignedVehicle } from '../hooks/useAssignedVehicle';
import { useDriverSession } from '../hooks/useDriverSession';
import type { UserProfileRecord } from '../lib/driverSession';

export interface DriverRecord {
  id: string;
  name?: string | null;
  user_id?: string | null;
  auth_user_id?: string | null;
  profile_id?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

export interface VehicleRecord {
  id: string;
  registration?: string | null;
  rego?: string | null;
  plate_number?: string | null;
  type?: string | null;
  depot?: string | null;
}

interface DriverContextValue {
  loading: boolean;
  authUserId: string | null;
  currentDriver: DriverRecord | null;
  currentProfile: UserProfileRecord | null;
  currentVehicle: VehicleRecord | null;
  error: string | null;
  reload: () => Promise<void>;
}

const DriverContext = createContext<DriverContextValue | undefined>(undefined);

export function DriverProvider({ children }: { children: ReactNode }) {
  const {
    loading,
    authUserId,
    currentDriver,
    currentProfile,
    error,
    refresh: refreshDriver,
  } = useDriverSession();

  const {
    vehicle,
    refresh: refreshVehicle,
  } = useAssignedVehicle(currentDriver?.id ?? null, !loading);

  const currentVehicle: VehicleRecord | null = vehicle
    ? {
        id: vehicle.id,
        registration: vehicle.registration ?? null,
        rego: vehicle.rego ?? null,
        plate_number: vehicle.plate_number ?? null,
        type: vehicle.type ?? null,
        depot: vehicle.depot ?? vehicle.depot_name ?? null,
      }
    : null;

  const reload = async () => {
    await refreshDriver();
    await refreshVehicle(true);
  };

  return (
    <DriverContext.Provider
      value={{
        loading,
        authUserId,
        currentDriver: (currentDriver as DriverRecord | null) ?? null,
        currentProfile,
        currentVehicle,
        error,
        reload,
      }}
    >
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const c = useContext(DriverContext);
  if (!c) throw new Error('useDriver must be used within DriverProvider');
  return c;
}
