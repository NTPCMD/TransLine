import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function StartShiftScreen({ navigation }: ScreenProps<'StartShift'>) {
  const { state, updateAppState } = useAppState();

  const handleStart = () => {
    updateAppState({ shiftStarted: true });
    navigation.navigate('PreStartChecklist');
  };

  const vehicle = state.assignedVehicle;

  return (
    <ScreenContainer title="Start your shift" subtitle="Confirm vehicle assignment before continuing">
      <View style={styles.card}>
        <Text style={styles.label}>Assigned vehicle</Text>
        <Text style={styles.value}>{vehicle?.registration ?? 'Not assigned'}</Text>
        <Text style={styles.meta}>{vehicle?.type ?? 'Select at depot'}</Text>
        <Text style={styles.meta}>{vehicle?.depot ?? 'Depot pending'}</Text>
      </View>
      <Button label="Begin pre-start checklist" onPress={handleStart} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  label: {
    color: '#6B7280',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    color: '#4B5563',
  },
});
