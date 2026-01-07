import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import TextField from '../components/TextField';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function EndShiftScreen({ navigation }: ScreenProps<'EndShift'>) {
  const { state, resetShift, updateAppState } = useAppState();
  const [rubbishRemoved, setRubbishRemoved] = useState<'yes' | 'no' | null>(state.endShiftRubbishRemoved);
  const [endShiftNotes, setEndShiftNotes] = useState(state.endShiftNotes);

  const handleRubbishChange = (value: 'yes' | 'no') => {
    setRubbishRemoved(value);
    updateAppState({ endShiftRubbishRemoved: value });
  };

  const handleNotesChange = (value: string) => {
    setEndShiftNotes(value);
    updateAppState({ endShiftNotes: value });
  };

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
      <InfoCard title="End of shift checklist">
        <Text style={styles.label}>Have you removed all rubbish from the vehicle?</Text>
        <View style={styles.choiceRow}>
          <Pressable
            onPress={() => handleRubbishChange('yes')}
            style={[styles.choiceButton, rubbishRemoved === 'yes' ? styles.choiceActive : styles.choiceInactive]}
          >
            <Text style={rubbishRemoved === 'yes' ? styles.choiceTextActive : styles.choiceTextInactive}>Yes</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRubbishChange('no')}
            style={[styles.choiceButton, rubbishRemoved === 'no' ? styles.choiceActive : styles.choiceInactive]}
          >
            <Text style={rubbishRemoved === 'no' ? styles.choiceTextActive : styles.choiceTextInactive}>No</Text>
          </Pressable>
        </View>
        <TextField
          label="End of shift notes"
          value={endShiftNotes}
          onChangeText={handleNotesChange}
          placeholder="Add any notes about your shift..."
          multiline
        />
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
  label: {
    color: '#2E2E2E',
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  choiceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  choiceActive: {
    backgroundColor: '#C62828',
  },
  choiceInactive: {
    backgroundColor: '#F2F2F2',
  },
  choiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  choiceTextInactive: {
    color: '#9E9E9E',
  },
});
