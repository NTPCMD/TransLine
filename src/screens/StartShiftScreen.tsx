import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import { useActiveAssignment } from '../state/AssignmentContext';
import type { ScreenProps } from '../types/navigation';

export default function StartShiftScreen(props: ScreenProps<'StartShift'>) {
  const { navigation } = props;
  const { state } = useAppState();
  const { status, vehicle } = useActiveAssignment();

  const assignedVehicle = state.assignedVehicle ?? vehicle;

  const vehicleRego =
    state.vehicleRegistration ??
    assignedVehicle?.rego ??
    vehicle?.rego;

  const vehicleMake = assignedVehicle?.make ?? vehicle?.make;
  const vehicleModel = assignedVehicle?.model ?? vehicle?.model;

  const handleConfirm = () => {
    if (!state.vehicleId) return;
    navigation.navigate('PreStartChecklist', { vehicleId: state.vehicleId });
  };

  return (
    <ScreenContainer title="Start your shift" subtitle="Confirm vehicle assignment before continuing">
      <View style={styles.card}>
        <Text style={styles.label}>Assigned vehicle</Text>
        <Text style={styles.value}>{vehicleRego ?? 'Not assigned'}</Text>
        {(vehicleMake || vehicleModel) && (
          <Text style={styles.meta}>{[vehicleMake, vehicleModel].filter(Boolean).join(' ')}</Text>
        )}
      </View>

      {status === 'loading' && (
        <Text style={styles.metaText}>Loading vehicle assignment...</Text>
      )}

      {status !== 'loading' && !state.vehicleId && (
        <Text style={styles.errorText}>Vehicle not assigned. Please contact admin.</Text>
      )}

      <Button
        label="Confirm vehicle"
        onPress={handleConfirm}
        disabled={status === 'loading' || !state.vehicleId}
      />
      <Button
        label="Back"
        variant="ghost"
        onPress={() => navigation.goBack()}
      />
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
});
