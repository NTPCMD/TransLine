import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import {
  MAX_BREAK_ALLOWANCE_SECONDS,
  summarizeBreakAllowance,
} from '../lib/breakAllowance';
import { startBreak as rpcStartBreak, endBreak as rpcEndBreak } from '../lib/shiftLifecycle';
import { useAppState } from '../state/AppStateContext';
import { useActiveShift } from '../state/ActiveShiftContext';
import { networkMonitor } from '../lib/networkMonitor';
import { offlineQueue } from '../lib/offlineQueue';
import type { ScreenProps } from '../types/navigation';

type BreakEventType = 'break_start' | 'break_end';

type BreakEventRow = {
  event_type: BreakEventType;
  created_at: string;
};

// Merge server break events with any still-queued (offline) ones so the timer
// and allowance stay correct without a connection. De-duped on type+timestamp:
// once a queued event syncs it is inserted with the same created_at, so the
// server copy replaces the queued copy cleanly instead of double-counting.
const mergeBreakEvents = (
  serverEvents: BreakEventRow[],
  queuedEvents: Array<{ event_type: string; created_at: string }>
): BreakEventRow[] => {
  const byKey = new Map<string, BreakEventRow>();
  const add = (eventType: string, createdAt: string) => {
    if (eventType !== 'break_start' && eventType !== 'break_end') return;
    byKey.set(`${eventType}|${createdAt}`, { event_type: eventType, created_at: createdAt });
  };
  serverEvents.forEach((event) => add(event.event_type, event.created_at));
  queuedEvents.forEach((event) => add(event.event_type, event.created_at));
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export default function BreakControlScreen(props: ScreenProps<'BreakControl'>) {
  const { navigation } = props;
  const { shift: activeShift, status: activeShiftStatus, reload: reloadActiveShift } = useActiveShift();
  const [breakEvents, setBreakEvents] = useState<BreakEventRow[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoEndedForAllowance, setAutoEndedForAllowance] = useState(false);
  const activeShiftLoading = activeShiftStatus === 'loading';

  const loadBreakEvents = useCallback(async () => {
    if (activeShiftLoading) {
      return;
    }

    if (!activeShift?.id) {
      setBreakEvents([]);
      return;
    }

    const shiftId = activeShift.id;
    const queued = offlineQueue.getQueuedShiftEvents(shiftId, ['break_start', 'break_end']);

    setIsLoadingEvents(true);
    try {
      const online = await networkMonitor.isOnline();
      let serverEvents: BreakEventRow[] = [];

      if (online) {
        const { data, error } = await supabase
          .from('shift_events')
          .select('event_type, created_at')
          .eq('shift_id', shiftId)
          .in('event_type', ['break_start', 'break_end'])
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[BreakControl] Failed to load break events', {
            shiftId,
            supabaseError: `${error.message} (code=${error.code ?? 'n/a'}, details=${error.details ?? 'n/a'}, hint=${error.hint ?? 'n/a'})`,
          });
          // Fall back to whatever is queued locally so the UI stays usable.
          setBreakEvents(mergeBreakEvents([], queued));
          return;
        }

        serverEvents = (data ?? []) as BreakEventRow[];
      }

      setBreakEvents(mergeBreakEvents(serverEvents, queued));
    } finally {
      setIsLoadingEvents(false);
    }
  }, [activeShift?.id, activeShiftLoading]);

  useEffect(() => {
    console.log('[Break] activeShift', { shiftId: activeShift?.id ?? null });
  }, [activeShift?.id]);

  useEffect(() => {
    console.log('[Break] activeShiftLoading', { activeShiftLoading });
  }, [activeShiftLoading]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void reloadActiveShift();
  }, [reloadActiveShift]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void reloadActiveShift();
    });
    return unsubscribe;
  }, [navigation, reloadActiveShift]);

  useEffect(() => {
    if (activeShiftLoading) return;
    void loadBreakEvents();
  }, [activeShift?.id, activeShiftLoading, loadBreakEvents]);

  // Reconcile when the offline queue drains (a queued break synced) or the
  // network comes back, so server data replaces the optimistic local copy.
  useEffect(() => {
    const unsubscribeQueue = offlineQueue.subscribe(() => {
      void loadBreakEvents();
    });
    const unsubscribeNetwork = networkMonitor.subscribe((isOnline) => {
      if (isOnline) void loadBreakEvents();
    });
    return () => {
      unsubscribeQueue();
      unsubscribeNetwork();
    };
  }, [loadBreakEvents]);

  const breakSummary = useMemo(() => {
    return summarizeBreakAllowance(breakEvents, nowMs);
  }, [breakEvents, nowMs]);

  // Records a break event, preferring the live RPC but falling back to the
  // offline queue when there is no connection (or the RPC fails on a flaky one),
  // so breaks are never lost and the timer keeps working without a network.
  const recordBreakEvent = useCallback(
    async (
      eventType: BreakEventType
    ): Promise<{ status: 'sent' | 'queued' | 'error'; error?: string }> => {
      const shiftId = activeShift?.id;
      if (!shiftId) {
        return { status: 'error', error: 'Cannot record break without an active shift.' };
      }

      const online = await networkMonitor.isOnline();
      if (online) {
        const rpcResult =
          eventType === 'break_start'
            ? await rpcStartBreak({ p_shift_id: shiftId })
            : await rpcEndBreak({ p_shift_id: shiftId });
        if (rpcResult.ok) {
          return { status: 'sent' };
        }
        console.warn('[Break] RPC failed, queuing offline', { eventType, error: rpcResult.error });
      }

      await offlineQueue.addEvent(eventType, {
        shift_id: shiftId,
        event_type: eventType,
        latitude: null,
        longitude: null,
        metadata: {},
      });
      return { status: 'queued' };
    },
    [activeShift?.id]
  );

  const endBreakWithAllowanceMetadata = useCallback(
    () => recordBreakEvent('break_end'),
    [recordBreakEvent]
  );

  useEffect(() => {
    if (!breakSummary.isOnBreak || autoEndedForAllowance || isProcessing || !activeShift?.id) {
      return;
    }

    if (!breakSummary.isUsedUp) {
      setAutoEndedForAllowance(false);
      return;
    }

    setAutoEndedForAllowance(true);
    setIsProcessing(true);
    void (async () => {
      try {
          const result = await endBreakWithAllowanceMetadata();
        if (result.status !== 'error') {
          await loadBreakEvents();
          alert('Break allowance already used. Break ended automatically.');
        } else {
          alert(result.error ?? 'Failed to auto-end break at allowance limit.');
        }
      } finally {
        setIsProcessing(false);
      }
    })();
  }, [
    activeShift?.id,
    autoEndedForAllowance,
    breakSummary.isOnBreak,
    breakSummary.isUsedUp,
    breakSummary.totalSeconds,
    endBreakWithAllowanceMetadata,
    isProcessing,
    loadBreakEvents,
  ]);

  const startBreak = async () => {
    console.log('[Break] startBreak pressed');
    if (isProcessing) return;
    if (!activeShift && !activeShiftLoading) {
      alert('Cannot start break without an active shift.');
      return;
    }
    if (activeShiftLoading || !activeShift?.id) return;
    if (breakSummary.remainingSeconds <= 0) {
      alert('Break allowance already used.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await recordBreakEvent('break_start');
      if (result.status === 'error') {
        alert(result.error ?? 'Failed to start break.');
        return;
      }
      setAutoEndedForAllowance(false);
      await loadBreakEvents();
      if (result.status === 'queued') {
        alert('You are offline. Break started and saved on this device — it will sync automatically.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const endBreak = async () => {
    if (isProcessing) return;
    if (!activeShift?.id) {
      alert('Cannot end break without an active shift.');
      return;
    }
    if (!breakSummary.isOnBreak) {
      alert('No active break to end.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await endBreakWithAllowanceMetadata();
      if (result.status === 'error') {
        alert(result.error ?? 'Failed to end break.');
        return;
      }
      await loadBreakEvents();
      if (result.status === 'queued') {
        alert('You are offline. Break ended and saved on this device — it will sync automatically.');
      }
    } finally {
      setIsProcessing(false);
    }
    navigation.goBack();
  };

  const minutes = Math.floor(breakSummary.totalSeconds / 60);
  const seconds = breakSummary.totalSeconds % 60;
  const remainingSeconds = breakSummary.remainingSeconds;
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const allowanceMinutes = Math.floor(MAX_BREAK_ALLOWANCE_SECONDS / 60);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Break Control</Text>
        <Text style={styles.subtitle}>Manage rest breaks</Text>

        <InfoCard title="Status">
          <Text style={styles.text}>Status: {breakSummary.isOnBreak ? 'On break' : 'Not on break'}</Text>
          <Text style={styles.meta}>Current session: {Math.floor(breakSummary.currentSessionSeconds / 60)}m {breakSummary.currentSessionSeconds % 60}s</Text>
          <Text style={styles.meta}>Total this shift: {minutes}m {seconds}s</Text>
          <Text style={styles.meta}>Allowed break time: {allowanceMinutes}m</Text>
          <Text style={styles.meta}>Remaining allowed: {remainingMinutes}m {remainingSeconds % 60}s</Text>
          <Text style={styles.meta}>Portal status: {breakSummary.portalStatus}</Text>
          {breakSummary.isUsedUp ? <Text style={styles.warningText}>Break allowance already used.</Text> : null}
          {breakSummary.isExceeded ? (
            <Text style={styles.warningText}>Exceeded allowance by {Math.floor(breakSummary.exceededBySeconds / 60)}m {breakSummary.exceededBySeconds % 60}s.</Text>
          ) : null}
          {isLoadingEvents && <Text style={styles.meta}>Refreshing break events...</Text>}
        </InfoCard>

        {!breakSummary.isOnBreak && (
          <View style={styles.buttonGroup}>
            <Button label="Start Break" onPress={startBreak} disabled={isProcessing || activeShiftLoading || remainingSeconds <= 0} />
          </View>
        )}

        {breakSummary.isOnBreak && (
          <View style={styles.buttonGroup}>
            <Button label="End Break" onPress={endBreak} disabled={isProcessing} />
          </View>
        )}

        <View style={styles.spacer} />
        <Button label="Back to Shift" variant="ghost" onPress={() => navigation.goBack()} disabled={isProcessing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  text: {
    color: '#111827',
    fontSize: 16,
    marginBottom: 8,
  },
  meta: {
    color: '#4B5563',
    fontSize: 14,
    marginBottom: 4,
  },
  warningText: {
    color: '#B91C1C',
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
  buttonGroup: {
    gap: 12,
    marginTop: 16,
  },
  spacer: {
    height: 16,
  },
});
