import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

const MAX_BREAK_SECONDS = 30 * 60; // 30 minutes
const DEFAULT_BREAK_SECONDS = 15 * 60; // 15 minutes default

type BreakStatus = 'idle' | 'running' | 'paused';

export default function BreakControlScreen({ navigation }: ScreenProps<'BreakControl'>) {
  const { closeActiveBreak, createEvent, state, updateAppState } = useAppState();
  const [status, setStatus] = useState<BreakStatus>('idle');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Timer effect - only runs when status is "running"
  useEffect(() => {
    if (status !== 'running') return;

    const id = setInterval(() => {
      setSecondsElapsed((s) => {
        const accumulated = (state.breakAccumulatedSeconds ?? 0);
        const newTotal = accumulated + s + 1;

        if (newTotal >= MAX_BREAK_SECONDS) {
          setStatus('idle');
          return 0;
        }
        return s + 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [status, state.breakAccumulatedSeconds]);

  useEffect(() => {
    if (state.isOnBreak && state.breakStartedAt) {
      setStatus('running');
      setSecondsElapsed(Math.floor((Date.now() - new Date(state.breakStartedAt).getTime()) / 1000));
      return;
    }
    if (status === 'running') {
      setStatus('idle');
      setSecondsElapsed(0);
    }
  }, [state.breakStartedAt, state.isOnBreak, status]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isProcessing) {
        event.preventDefault();
        return;
      }
      if (!state.isOnBreak) {
        return;
      }
      event.preventDefault();
      setIsProcessing(true);
      closeActiveBreak()
        .catch(() => undefined)
        .finally(() => {
          setIsProcessing(false);
          navigation.dispatch(event.data.action);
        });
    });

    return unsubscribe;
  }, [closeActiveBreak, isProcessing, navigation, state.isOnBreak]);

  const startBreak = async () => {
    if (isProcessing) return;
    if ((state.breakAccumulatedSeconds ?? 0) >= MAX_BREAK_SECONDS) {
      alert('Maximum break time (30 minutes) already reached for this shift.');
      return;
    }
    setStatus('running');
    setSecondsElapsed(0);
    updateAppState({ isOnBreak: true, breakStartedAt: new Date().toISOString() });
    setIsProcessing(true);
    try {
      await createEvent('break_start');
    } finally {
      setIsProcessing(false);
    }
  };

  const pauseBreak = () => {
    if (!state.breakStartedAt) return;
    const started = new Date(state.breakStartedAt).getTime();
    const delta = Math.floor((Date.now() - started) / 1000);
    const newAccum = (state.breakAccumulatedSeconds ?? 0) + delta;
    setStatus('paused');
    updateAppState({ isOnBreak: false, breakStartedAt: null, breakAccumulatedSeconds: newAccum });
  };

  const resumeBreak = () => {
    setStatus('running');
    updateAppState({ isOnBreak: true, breakStartedAt: new Date().toISOString() });
  };

  const endBreak = async () => {
    if (isProcessing) return;
    const totalSeconds = (state.breakAccumulatedSeconds ?? 0) + (status === 'running' ? secondsElapsed : 0);
    if (state.breakStartedAt && status === 'running') {
      pauseBreak();
    }
    setStatus('idle');
    setSecondsElapsed(0);
    updateAppState({ isOnBreak: false, breakStartedAt: null, breakAccumulatedSeconds: totalSeconds });
    setIsProcessing(true);
    try {
      await createEvent('break_end', { duration_seconds: totalSeconds });
    } finally {
      setIsProcessing(false);
    }
    navigation.goBack();
  };

  const accumulated = (state.breakAccumulatedSeconds ?? 0) + (status === 'running' ? secondsElapsed : 0);
  const minutes = Math.floor(accumulated / 60);
  const seconds = accumulated % 60;
  const remainingSeconds = MAX_BREAK_SECONDS - accumulated;
  const remainingMinutes = Math.floor(remainingSeconds / 60);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Break Control</Text>
        <Text style={styles.subtitle}>Manage rest breaks</Text>

        <InfoCard title="Status">
          <Text style={styles.text}>Status: {status === 'idle' ? 'Not on break' : status === 'running' ? 'On break' : 'Paused'}</Text>
          <Text style={styles.meta}>Current session: {Math.floor(secondsElapsed / 60)}m {secondsElapsed % 60}s</Text>
          <Text style={styles.meta}>Total this shift: {minutes}m {seconds}s</Text>
          <Text style={styles.meta}>Remaining allowed: {remainingMinutes}m {remainingSeconds % 60}s</Text>
        </InfoCard>

        {/* Idle state - show Start button */}
        {status === 'idle' && (
          <View style={styles.buttonGroup}>
            <Button label="Start Break" onPress={startBreak} disabled={isProcessing} />
          </View>
        )}

        {/* Running state - show Pause and End buttons */}
        {status === 'running' && (
          <View style={styles.buttonGroup}>
            <Button label="Pause Break" onPress={pauseBreak} disabled={isProcessing} />
            <Button label="End Break" variant="ghost" onPress={endBreak} disabled={isProcessing} />
          </View>
        )}

        {/* Paused state - show Resume and End buttons */}
        {status === 'paused' && (
          <View style={styles.buttonGroup}>
            <Button label="Resume Break" onPress={resumeBreak} disabled={isProcessing} />
            <Button label="End Break" variant="ghost" onPress={endBreak} disabled={isProcessing} />
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
