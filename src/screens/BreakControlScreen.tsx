import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function BreakControlScreen({ navigation }: ScreenProps<'BreakControl'>) {
  const { state, updateAppState } = useAppState();

  const toggleBreak = () => {
    updateAppState({ onBreak: !state.onBreak });
  };

  return (
    <ScreenContainer title="Break control" subtitle="Manage rest breaks">
      <InfoCard title="Status">
        <Text style={styles.text}>On break: {state.onBreak ? 'Yes' : 'No'}</Text>
        <Text style={styles.meta}>Use this screen to start or end your break.</Text>
      </InfoCard>
      <Button label={state.onBreak ? 'End break' : 'Start break'} onPress={toggleBreak} />
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
