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

    try {
      const { data: assignment, error: assignmentError } = await supabase
        .from('vehicle_assignments')
        .select('vehicle_id, unassigned_at')
        .eq('driver_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignmentError) {
        console.warn('Error fetching vehicle assignment', { message: assignmentError.message });
      }

      if (!assignment || assignment.unassigned_at) {
        setCurrentVehicle(null);
        setLoading(false);
        return;
      }

      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, registration, type, depot')
        .eq('id', assignment.vehicle_id)
        .maybeSingle();

      if (vehicleError) {
        console.warn('Error fetching assigned vehicle details', { message: vehicleError.message });
      }

      setCurrentVehicle(vehicle ?? null);
      setLoading(false);
      return;
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
