import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { useAppState } from '../state/AppStateContext';
import { useActiveShift } from '../state/ActiveShiftContext';
import type { ScreenProps } from '../types/navigation';

const MAX_BREAK_SECONDS = 30 * 60; // 30 minutes
type BreakEventType = 'break_start' | 'break_end';

type BreakEventRow = {
  event_type: BreakEventType;
  created_at: string;
};

export default function BreakControlScreen(props: ScreenProps<'BreakControl'>) {
  const { navigation } = props;
  const { createEvent } = useAppState();
  const { shift: activeShift, status: activeShiftStatus, reload: reloadActiveShift } = useActiveShift();
  const [breakEvents, setBreakEvents] = useState<BreakEventRow[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);
  const activeShiftLoading = activeShiftStatus === 'loading';

  const loadBreakEvents = useCallback(async () => {
    if (activeShiftLoading) {
      return;
    }

    if (!activeShift?.id) {
      setBreakEvents([]);
      return;
    }

    setIsLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('shift_events')
        .select('event_type, created_at')
        .eq('shift_id', activeShift.id)
        .in('event_type', ['break_start', 'break_end'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[BreakControl] Failed to load break events', {
          shiftId: activeShift.id,
          supabaseError: `${error.message} (code=${error.code ?? 'n/a'}, details=${error.details ?? 'n/a'}, hint=${error.hint ?? 'n/a'})`,
        });
        return;
      }

      setBreakEvents((data ?? []) as BreakEventRow[]);
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

  const breakSummary = useMemo(() => {
    let totalSeconds = 0;
    let activeBreakStartMs: number | null = null;

    for (const event of breakEvents) {
      const eventMs = new Date(event.created_at).getTime();
      if (!Number.isFinite(eventMs)) continue;

      if (event.event_type === 'break_start') {
        activeBreakStartMs = eventMs;
        continue;
      }

      if (event.event_type === 'break_end' && activeBreakStartMs !== null) {
        if (eventMs > activeBreakStartMs) {
          totalSeconds += Math.floor((eventMs - activeBreakStartMs) / 1000);
        }
        activeBreakStartMs = null;
      }
    }

    if (activeBreakStartMs !== null && nowMs > activeBreakStartMs) {
      totalSeconds += Math.floor((nowMs - activeBreakStartMs) / 1000);
    }

    const remainingSeconds = Math.max(0, MAX_BREAK_SECONDS - totalSeconds);
    const lastEventType = breakEvents.length > 0 ? breakEvents[breakEvents.length - 1].event_type : null;

    return {
      totalSeconds,
      remainingSeconds,
      activeBreakStartMs,
      isOnBreak: lastEventType === 'break_start',
      currentSessionSeconds:
        activeBreakStartMs !== null && nowMs > activeBreakStartMs
          ? Math.floor((nowMs - activeBreakStartMs) / 1000)
          : 0,
    };
  }, [breakEvents, nowMs]);

  const startBreak = async () => {
    console.log('[Break] startBreak pressed');
    if (isProcessing) return;
    if (!activeShift && !activeShiftLoading) {
      alert('Cannot start break without an active shift.');
      return;
    }
    if (activeShiftLoading || !activeShift?.id) return;
    if (breakSummary.remainingSeconds <= 0) {
      alert('Maximum break time (30 minutes) already reached for this shift.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await createEvent('break_start', {}, undefined, activeShift.id);
      if (result.status === 'sent' || result.status === 'queued') {
        await loadBreakEvents();
        if (result.status === 'queued') {
          alert('Saved offline. Will sync automatically.');
        }
      } else {
        alert(result.error ?? 'Failed to persist break start event.');
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

    const totalSeconds = breakSummary.totalSeconds;

    setIsProcessing(true);
    try {
      const result = await createEvent('break_end', { duration_seconds: totalSeconds }, undefined, activeShift.id);
      if (result.status === 'sent' || result.status === 'queued') {
        await loadBreakEvents();
        if (result.status === 'queued') {
          alert('Saved offline. Will sync automatically.');
        }
      } else {
        alert(result.error ?? 'Failed to persist break end event.');
        return;
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Break Control</Text>
        <Text style={styles.subtitle}>Manage rest breaks</Text>

        <InfoCard title="Status">
          <Text style={styles.text}>Status: {breakSummary.isOnBreak ? 'On break' : 'Not on break'}</Text>
          <Text style={styles.meta}>Current session: {Math.floor(breakSummary.currentSessionSeconds / 60)}m {breakSummary.currentSessionSeconds % 60}s</Text>
          <Text style={styles.meta}>Total this shift: {minutes}m {seconds}s</Text>
          <Text style={styles.meta}>Remaining allowed: {remainingMinutes}m {remainingSeconds % 60}s</Text>
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
  buttonGroup: {
    gap: 12,
    marginTop: 16,
  },
  spacer: {
    height: 16,
  },
});
