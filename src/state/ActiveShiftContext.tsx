import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { networkMonitor } from '../lib/networkMonitor';

export interface Shift {
  id: string;
  driver_id: string;
  vehicle_id: string;
  started_at: string | null;
  ended_at: string | null;
  status: 'pending' | 'active' | 'ended' | string;
}

export type ActiveShiftStatus = 'none' | 'loading' | 'active' | 'error';

interface ActiveShiftContextValue {
  shift: Shift | null;
  status: ActiveShiftStatus;
  error: string | null;
  reload: () => Promise<void>;
}

const ActiveShiftContext = createContext<ActiveShiftContextValue | undefined>(undefined);

export function ActiveShiftProvider({ children, driverId }: { children: ReactNode; driverId: string | null }) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [status, setStatus] = useState<ActiveShiftStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);

    if (!driverId) {
      setShift(null);
      setStatus('none');
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('shifts')
        .select('*')
        .eq('driver_id', driverId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('[ActiveShift] Error fetching shift:', fetchError);
        setError(fetchError.message);
        setStatus('error');
        return;
      }

      if (data) {
        console.log('[ActiveShift] Found active shift:', data.id);
        setShift(data as Shift);
        setStatus('active');
      } else {
        console.log('[ActiveShift] No active shift');
        setShift(null);
        setStatus('none');
      }
    } catch (e) {
      console.error('[ActiveShift] Exception:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  }, [driverId]);

  useEffect(() => {
    reload();
  }, [reload, driverId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const resumed = (previousState === 'background' || previousState === 'inactive') && nextState === 'active';
      if (resumed) {
        console.log('[ActiveShift] app resumed; refreshing active shift');
        void reload();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [reload]);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((isOnline) => {
      if (!isOnline) return;
      console.log('[ActiveShift] network reconnected; refreshing active shift');
      void reload();
    });

    return () => {
      unsubscribe();
    };
  }, [reload]);

  return (
    <ActiveShiftContext.Provider value={{ shift, status, error, reload }}>
      {children}
    </ActiveShiftContext.Provider>
  );
}

export function useActiveShift() {
  const context = useContext(ActiveShiftContext);
  if (!context) {
    throw new Error('useActiveShift must be used within ActiveShiftProvider');
  }
  return context;
}
