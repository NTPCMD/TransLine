import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import { useActiveAssignment } from '../state/AssignmentContext';
import type { ScreenProps } from '../types/navigation';

export default function StartShiftScreen({ navigation }: ScreenProps<'StartShift'>) {
  const { state } = useAppState();
  const { status, vehicle } = useActiveAssignment();
  const buildStamp = 'build-2026-02-01-assignments';

  const handleStart = () => {
    console.log('start shift pressed', {
      assignmentStatus: status,
      vehicleId: state.vehicleId,
    });
    navigation.navigate('PreStartChecklist');
  };

  const assignedVehicle = state.assignedVehicle ?? vehicle;
  const vehicleRegistration =
    state.vehicleRegistration ??
    assignedVehicle?.registration ??
    vehicle?.registration ??
    vehicle?.rego ??
    vehicle?.plate_number ??
    vehicle?.name;

  return (
    <ScreenContainer title="Start your shift" subtitle="Confirm vehicle assignment before continuing">
      <View style={styles.card}>
        <Text style={styles.label}>Assigned vehicle</Text>
        <Text style={styles.value}>{vehicleRegistration ?? 'Not assigned'}</Text>
        <Text style={styles.meta}>{assignedVehicle?.type ?? vehicle?.type ?? 'Select at depot'}</Text>
        <Text style={styles.meta}>{assignedVehicle?.depot ?? vehicle?.depot ?? vehicle?.depot_name ?? 'Depot pending'}</Text>
      </View>
      {status === 'loading' ? <Text style={styles.metaText}>Loading vehicle assignment...</Text> : null}
      {status !== 'loading' && !state.vehicleId ? (
        <Text style={styles.errorText}>Vehicle not assigned. Please contact admin.</Text>
      ) : null}
      <Button label="Begin pre-start checklist" onPress={handleStart} disabled={status === 'loading' || !state.vehicleId} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
      <Text style={styles.buildStamp}>Build: {buildStamp}</Text>
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
  errorText: {
    color: '#D32F2F',
    marginTop: 8,
  },
  metaText: {
    color: '#6B7280',
    marginTop: 8,
  },
  buildStamp: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});
