import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function ShiftDetailsScreen({ navigation }: ScreenProps<'ShiftDetails'>) {
  const { state } = useAppState();

  return (
    <ScreenContainer title="Shift details" subtitle="Review current shift information">
      <InfoCard title="Vehicle">
        <Text style={styles.text}>{state.assignedVehicle?.registration ?? 'Not assigned'}</Text>
        <Text style={styles.meta}>{state.assignedVehicle?.type ?? 'Vehicle type pending'}</Text>
        <Text style={styles.meta}>{state.assignedVehicle?.depot ?? 'Depot pending'}</Text>
      </InfoCard>
      <InfoCard title="Times">
        <Text style={styles.text}>Started: {state.shiftStartTime ? state.shiftStartTime.toLocaleTimeString() : 'Not set'}</Text>
        <Text style={styles.meta}>Checklist complete: {state.checklistCompleted ? 'Yes' : 'No'}</Text>
      </InfoCard>
      <InfoCard title="Readings">
        <Text style={styles.text}>Odometer: {state.odometerReading || 'Pending'}</Text>
        <Text style={styles.meta}>Photo note: {state.odometerPhoto || 'Not provided'}</Text>
      </InfoCard>
      <Button label="Back to shift" onPress={() => navigation.goBack()} />
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
