import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface DriverRecord {
  id: string;
  name?: string | null;
  auth_user_id?: string | null;
}

export interface VehicleRecord {
  id: string;
  registration?: string | null;
  type?: string | null;
  depot?: string | null;
}

interface DriverContextValue {
  loading: boolean;
  authUserId: string | null;
  currentDriver: DriverRecord | null;
  currentVehicle: VehicleRecord | null;
  reload: () => Promise<void>;
}

const DriverContext = createContext<DriverContextValue | undefined>(undefined);

export function DriverProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [currentDriver, setCurrentDriver] = useState<DriverRecord | null>(null);
  const [currentVehicle, setCurrentVehicle] = useState<VehicleRecord | null>(null);

  const resolveDriverAndVehicle = async (userId: string | null) => {
    setLoading(true);
    setCurrentDriver(null);
    setCurrentVehicle(null);
    if (!userId) {
      setAuthUserId(null);
      setLoading(false);
      return;
    }

    setAuthUserId(userId);

    // Try to resolve driver record by auth_user_id
    let driver: DriverRecord | null = null;
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, auth_user_id')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (error) {
        console.warn('[Driver] Error fetching driver record by auth_user_id', { message: error.message });
      }
      driver = data ?? null;
    } catch (e) {
      console.warn('[Driver] Exception while fetching driver by auth_user_id', e);
      driver = null;
    }

    setCurrentDriver(driver as DriverRecord | null);

    // Use single source of truth: vehicles.assigned_driver_id = auth.uid()
    try {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, registration, type, depot')
        .eq('assigned_driver_id', userId)
        .limit(1)
        .maybeSingle();

      if (vehicleError) {
        console.warn('[Driver] Error fetching assigned vehicle', { message: vehicleError.message });
        setCurrentVehicle(null);
      } else {
        setCurrentVehicle(vehicle ?? null);
      }
      setLoading(false);
      return;
    } catch (e) {
      console.warn('[Driver] Exception while fetching assigned vehicle', e);
      setCurrentVehicle(null);
    }

    setCurrentVehicle(null);
    setLoading(false);
  };

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_, session) => {
      const uid = session?.user?.id ?? null;
      void resolveDriverAndVehicle(uid);
    });

    // initial resolver
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[Driver] Error fetching session', { message: error.message });
      }
      await resolveDriverAndVehicle(data?.session?.user?.id ?? null);
    })();

    return () => data.subscription.unsubscribe();
  }, []);

  const reload = async () => {
    await resolveDriverAndVehicle(authUserId);
  };

  return (
    <DriverContext.Provider value={{ loading, authUserId, currentDriver, currentVehicle, reload }}>
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const c = useContext(DriverContext);
  if (!c) throw new Error('useDriver must be used within DriverProvider');
  return c;
}
