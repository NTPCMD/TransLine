import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface DriverRecord {
  id: string;
  name?: string | null;
  user_id?: string | null;
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

    // Try to resolve driver record by user_id or auth_user_id
    let driver = null;
    try {
      const { data, error } = await supabase.from('drivers').select('id, name, user_id, auth_user_id').or(`user_id.eq.${userId},auth_user_id.eq.${userId}`).maybeSingle();
      if (error) {
        console.warn('Error fetching driver record', { message: error.message });
      }
      driver = data ?? null;
    } catch (e) {
      console.warn('Exception while fetching driver', e);
      driver = null;
    }

    setCurrentDriver(driver as DriverRecord | null);

    if (!driver) {
      setLoading(false);
      return;
    }

    // Resolve assigned vehicle. Support two patterns:
    // Option A: vehicles.assigned_driver_id
    // Option B: driver_vehicles join table with active=true
    try {
      // Option A
      const { data: vehicleA, error: vErrA } = await supabase
        .from('vehicles')
        .select('id, registration, type, depot')
        .eq('assigned_driver_id', driver.id)
        .limit(1)
        .maybeSingle();

      if (!vErrA && vehicleA) {
        setCurrentVehicle(vehicleA as VehicleRecord);
        setLoading(false);
        return;
      }

      // Option B: driver_vehicles
      const { data: dv, error: dvErr } = await supabase
        .from('driver_vehicles')
        .select('vehicle_id')
        .eq('driver_id', driver.id)
        .eq('active', true)
        .limit(1);

      if (!dvErr && dv && dv.length > 0) {
        const vid = (dv[0] as any).vehicle_id as string;
        const { data: vehicleB, error: vErrB } = await supabase
          .from('vehicles')
          .select('id, registration, type, depot')
          .eq('id', vid)
          .maybeSingle();
        if (!vErrB && vehicleB) {
          setCurrentVehicle(vehicleB as VehicleRecord);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Exception while fetching assigned vehicle', e);
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
      const session = supabase.auth.session();
      await resolveDriverAndVehicle(session?.user?.id ?? null);
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
