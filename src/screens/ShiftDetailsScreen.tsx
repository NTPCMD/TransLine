import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function ShiftDetailsScreen(props: ScreenProps<'ShiftDetails'>) {
  const { navigation } = props;
  const { state } = useAppState();
  const checklistAnswers = state.preStartChecklistAnswers;
  const shiftNotes = state.shiftNotes;

  return (
    <ScreenContainer title="Shift details" subtitle="Review current shift information">
      <InfoCard title="Vehicle">
        <Text style={styles.text}>{state.vehicleRegistration ?? state.assignedVehicle?.registration ?? 'Not assigned'}</Text>
        <Text style={styles.meta}>{state.assignedVehicle?.type ?? 'Vehicle type pending'}</Text>
        <Text style={styles.meta}>{state.assignedVehicle?.depot ?? 'Depot pending'}</Text>
      </InfoCard>
      <InfoCard title="Times">
        <Text style={styles.text}>Started: {state.shiftStartTime ? state.shiftStartTime.toLocaleTimeString() : 'Not set'}</Text>
        <Text style={styles.meta}>Checklist submitted: {state.checklistSubmitted ? 'Yes' : 'No'}</Text>
        <Text style={styles.meta}>Checklist passed: {state.checklistCompleted ? 'Yes' : 'No'}</Text>
      </InfoCard>
      <InfoCard title="Readings">
        <Text style={styles.text}>Odometer: {state.odometerReading || 'Pending'}</Text>
        <Text style={styles.meta}>Photo note: {state.odometerPhoto || 'Not provided'}</Text>
      </InfoCard>
      <InfoCard title="Start-of-shift checklist">
        {checklistAnswers.length === 0 ? (
          <Text style={styles.meta}>No checklist answers recorded.</Text>
        ) : (
          checklistAnswers.map(answer => (
            <Text key={answer.id} style={styles.meta}>
              {answer.sectionTitle}: {answer.label} — {answer.status === 'pass' ? 'Pass' : 'Fail'}
              {answer.note ? ` (${answer.note})` : ''}
            </Text>
          ))
        )}
      </InfoCard>
      <InfoCard title="End-of-shift checklist">
        <Text style={styles.meta}>
          Rubbish removed: {state.endShiftRubbishRemoved ? (state.endShiftRubbishRemoved === 'yes' ? 'Yes' : 'No') : 'Not answered'}
        </Text>
        <Text style={styles.meta}>End of shift notes: {state.endShiftNotes || 'None recorded'}</Text>
      </InfoCard>
      <InfoCard title="Shift notes">
        {shiftNotes.length === 0 ? (
          <Text style={styles.meta}>No shift notes captured.</Text>
        ) : (
          shiftNotes.map((note, index) => (
            <Text key={`${note}-${index}`} style={styles.meta}>
              • {note}
            </Text>
          ))
        )}
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
