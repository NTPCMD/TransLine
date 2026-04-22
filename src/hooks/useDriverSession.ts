import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchDriverContext,
  type DriverProfileRecord,
  type UserProfileRecord,
} from '../lib/driverSession';

interface DriverSessionState {
  loading: boolean;
  authUserId: string | null;
  currentDriver: DriverProfileRecord | null;
  currentProfile: UserProfileRecord | null;
  error: string | null;
}

export function useDriverSession() {
  const [state, setState] = useState<DriverSessionState>({
    loading: true,
    authUserId: null,
    currentDriver: null,
    currentProfile: null,
    error: null,
  });

  const load = useCallback(async (authUserId?: string | null) => {
    console.log('[DriverSessionHook] load:start', {
      requestedAuthUserId: authUserId ?? null,
    });
    setState(prev => ({ ...prev, loading: true, error: null }));

    const result = await fetchDriverContext(authUserId ?? null);

    console.log('[DriverSessionHook] load:result', {
      authUserId: result.authUserId,
      driverId: result.driver?.id ?? null,
      profileId: result.profile?.id ?? null,
      error: result.error ?? null,
    });

    setState({
      loading: false,
      authUserId: result.authUserId,
      currentDriver: result.driver,
      currentProfile: result.profile,
      error: result.error ?? null,
    });
  }, []);

  useEffect(() => {
    void load();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DriverSessionHook] onAuthStateChange', {
        event,
        sessionUserId: session?.user?.id ?? null,
      });
      void load(session?.user?.id ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [load]);

  return {
    ...state,
    refresh: async () => {
      await load(state.authUserId);
    },
  };
}
