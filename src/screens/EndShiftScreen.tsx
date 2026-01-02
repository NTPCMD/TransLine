import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function EndShiftScreen({ navigation }: ScreenProps<'EndShift'>) {
  const { state, resetShift, updateAppState } = useAppState();

  const handleConfirm = () => {
    resetShift();
    updateAppState({ isLoggedIn: true, declarationAccepted: true });
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <ScreenContainer title="End shift" subtitle="Complete your shift and log out">
      <InfoCard title="Summary">
        <Text style={styles.text}>Vehicle: {state.assignedVehicle?.registration ?? 'Unknown'}</Text>
        <Text style={styles.text}>Start time: {state.shiftStartTime ? state.shiftStartTime.toLocaleTimeString() : 'Not set'}</Text>
        <Text style={styles.text}>Odometer: {state.odometerReading || 'Pending'}</Text>
      </InfoCard>
      <Button label="Confirm end" onPress={handleConfirm} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#111827',
    fontSize: 16,
  },
});
