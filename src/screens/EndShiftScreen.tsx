import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import TextField from '../components/TextField';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function EndShiftScreen({ navigation }: ScreenProps<'EndShift'>) {
  const { closeActiveBreak, createEvent, endShift, state, resetShift, updateAppState } = useAppState();
  const [rubbishRemoved, setRubbishRemoved] = useState<'yes' | 'no' | null>(state.endShiftRubbishRemoved);
  const [endShiftNotes, setEndShiftNotes] = useState(state.endShiftNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isSubmitting) {
        return;
      }
      event.preventDefault();
    });

    return unsubscribe;
  }, [isSubmitting, navigation]);

  const handleRubbishChange = (value: 'yes' | 'no') => {
    setRubbishRemoved(value);
    updateAppState({ endShiftRubbishRemoved: value });
  };

  const handleNotesChange = (value: string) => {
    setEndShiftNotes(value);
    updateAppState({ endShiftNotes: value });
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (!state.activeShiftId) {
      Alert.alert('Unable to end shift', 'No active shift found.');
      return;
    }
    setIsSubmitting(true);
    let shouldReset = true;
    try {
      if (state.isOnBreak) {
        await closeActiveBreak();
      }
      const shiftEndResult = await createEvent(
        'shift_end',
        { end_shift_notes: endShiftNotes },
        { queueOnError: false }
      );
      if (shiftEndResult.status === 'error') {
        Alert.alert('Unable to end shift', shiftEndResult.error ?? 'Unable to end shift.');
        return;
      }
      const ended = await endShift();
      if (!ended.ok) {
        Alert.alert('Unable to end shift', ended.error ?? 'Unable to end shift.');
        return;
      }
      resetShift();
      updateAppState({ isLoggedIn: true, declarationAccepted: true });
      shouldReset = false;
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      Alert.alert('Unable to end shift', error instanceof Error ? error.message : 'Unable to end shift.');
    } finally {
      if (shouldReset) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <ScreenContainer title="End shift" subtitle="Complete your shift and log out">
      <InfoCard title="Summary">
        <Text style={styles.text}>Vehicle: {state.vehicleRegistration ?? state.assignedVehicle?.registration ?? 'Unknown'}</Text>
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
      <Button label={isSubmitting ? 'Ending...' : 'Confirm end'} onPress={handleConfirm} disabled={isSubmitting} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} disabled={isSubmitting} />
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
