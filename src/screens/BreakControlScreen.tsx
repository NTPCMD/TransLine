import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

const MAX_BREAK_SECONDS = 30 * 60; // 30 minutes

export default function BreakControlScreen({ navigation }: ScreenProps<'BreakControl'>) {
  const { state, updateAppState } = useAppState();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const getAccumulated = () => {
    const acc = state.breakAccumulatedSeconds ?? 0;
    if (state.breakStartedAt) {
      const started = new Date(state.breakStartedAt).getTime();
      const delta = Math.floor((now - started) / 1000);
      return acc + delta;
    }
    return acc;
  };

  const startBreak = () => {
    if ((state.breakAccumulatedSeconds ?? 0) >= MAX_BREAK_SECONDS) {
      alert('Maximum break time (30 minutes) already reached for this shift.');
      return;
    }
    updateAppState({ onBreak: true, breakStartedAt: new Date().toISOString() });
  };

  const pauseBreak = () => {
    if (!state.breakStartedAt) return;
    const started = new Date(state.breakStartedAt).getTime();
    const delta = Math.floor((Date.now() - started) / 1000);
    const newAccum = (state.breakAccumulatedSeconds ?? 0) + delta;
    updateAppState({ onBreak: false, breakStartedAt: null, breakAccumulatedSeconds: newAccum });
  };

  const endBreak = () => {
    // End and navigate back
    if (state.breakStartedAt) pauseBreak();
    navigation.goBack();
  };

  const accumulated = getAccumulated();
  const minutes = Math.floor(accumulated / 60);
  const seconds = accumulated % 60;

  return (
    <ScreenContainer title="Break control" subtitle="Manage rest breaks">
      <InfoCard title="Status">
        <Text style={styles.text}>On break: {state.onBreak ? 'Yes' : 'No'}</Text>
        <Text style={styles.meta}>Total this shift: {minutes}m {seconds}s</Text>
        <Text style={styles.meta}>Maximum allowed: 30 minutes</Text>
      </InfoCard>

      {!state.onBreak && !(state.breakStartedAt) ? (
        <Button label="Start break" onPress={startBreak} />
      ) : null}

      {state.onBreak && state.breakStartedAt ? (
        <View>
          <Button label="Pause break" onPress={pauseBreak} />
          <Button label="End break" variant="ghost" onPress={endBreak} />
        </View>
      ) : null}

      {!state.onBreak && (state.breakAccumulatedSeconds ?? 0) > 0 ? (
        <View>
          <Button label="Resume break" onPress={startBreak} />
          <Button label="End break" variant="ghost" onPress={endBreak} />
        </View>
      ) : null}

      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#111827',
    fontSize: 16,
  },
  meta: {
    color: '#4B5563',
  },
});
