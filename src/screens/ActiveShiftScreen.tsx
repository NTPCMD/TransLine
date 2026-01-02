import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import ScreenContainer from '../components/ScreenContainer';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function ActiveShiftScreen({ navigation }: ScreenProps<'ActiveShift'>) {
  const { state } = useAppState();

  return (
    <ScreenContainer title="Active shift" subtitle="Access key controls while on duty">
      <InfoCard title="Vehicle details">
        <Text style={styles.text}>{state.assignedVehicle?.registration ?? 'Not assigned'}</Text>
        <Text style={styles.meta}>{state.assignedVehicle?.type ?? 'Vehicle type pending'}</Text>
        <Text style={styles.meta}>{state.assignedVehicle?.depot ?? 'Depot pending'}</Text>
      </InfoCard>
      <InfoCard title="Shift status">
        <Text style={styles.text}>Shift started: {state.shiftStartTime ? state.shiftStartTime.toLocaleTimeString() : 'Not set'}</Text>
        <Text style={styles.meta}>On break: {state.onBreak ? 'Yes' : 'No'}</Text>
        <Text style={styles.meta}>Odometer: {state.odometerReading || 'Pending'}</Text>
      </InfoCard>
      <View style={styles.buttonGrid}>
        <Button label="Shift details" variant="secondary" onPress={() => navigation.navigate('ShiftDetails')} />
        <Button label="Start/End break" variant="secondary" onPress={() => navigation.navigate('BreakControl')} />
        <Button label="Fuel log" variant="secondary" onPress={() => navigation.navigate('FuelLog')} />
        <Button label="Incident" variant="secondary" onPress={() => navigation.navigate('IncidentReport')} />
        <Button label="Send note" variant="secondary" onPress={() => navigation.navigate('SendNote')} />
        <Button label="Medical" variant="secondary" onPress={() => navigation.navigate('MedicalAbsence')} />
        <Button label="Announcements" variant="secondary" onPress={() => navigation.navigate('Announcements')} />
        <Button label="Ops alerts" variant="secondary" onPress={() => navigation.navigate('OperationsAlerts')} />
        <Button label="Components" variant="secondary" onPress={() => navigation.navigate('ComponentsLibrary')} />
        <Button label="Maintenance" variant="secondary" onPress={() => navigation.navigate('VehicleMaintenanceLog')} />
      </View>
      <Button label="End shift" onPress={() => navigation.navigate('EndShift')} />
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
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
