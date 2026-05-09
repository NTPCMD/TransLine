import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable, TextInput, ScrollView } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

type ChecklistValue = 'pass' | 'fail' | null;

const initialChecklistState = {
  tyre_pressure: null,
  tread_depth: null,
  wheel_nuts: null,
  headlights: null,
  indicators: null,
  brake_lights: null,
  engine_oil: null,
  coolant: null,
  washer_fluid: null,
  brake_test: null,
  park_brake: null,
  body_damage: null,
  clean: null,
  windscreen: null,
  mirrors: null,
} as const;

type ChecklistKey = keyof typeof initialChecklistState;

type ChecklistSection = {
  id: string;
  title: string;
  items: Array<{
    key: ChecklistKey;
    label: string;
    critical: boolean;
  }>;
};

const initialNotesState: Record<ChecklistKey, string> = {
  tyre_pressure: '',
  tread_depth: '',
  wheel_nuts: '',
  headlights: '',
  indicators: '',
  brake_lights: '',
  engine_oil: '',
  coolant: '',
  washer_fluid: '',
  brake_test: '',
  park_brake: '',
  body_damage: '',
  clean: '',
  windscreen: '',
  mirrors: '',
};

const initialExpandedState: Record<string, boolean> = {
  tyres: true,
  lights: false,
  fluids: false,
  brakes: false,
  exterior: false,
};

const checklistSections: ChecklistSection[] = [
  {
    id: 'tyres',
    title: 'Tyres & Wheels',
    items: [
      { key: 'tyre_pressure', label: 'Tyre pressure adequate', critical: false },
      { key: 'tread_depth', label: 'Tread depth acceptable', critical: true },
      { key: 'wheel_nuts', label: 'Wheel nuts secure', critical: true },
    ],
  },
  {
    id: 'lights',
    title: 'Lights & Indicators',
    items: [
      { key: 'headlights', label: 'Headlights working', critical: true },
      { key: 'indicators', label: 'Indicators working', critical: true },
      { key: 'brake_lights', label: 'Brake lights working', critical: true },
    ],
  },
  {
    id: 'fluids',
    title: 'Fluids',
    items: [
      { key: 'engine_oil', label: 'Engine oil level', critical: true },
      { key: 'coolant', label: 'Coolant level', critical: true },
      { key: 'washer_fluid', label: 'Washer fluid', critical: false },
    ],
  },
  {
    id: 'brakes',
    title: 'Brakes',
    items: [
      { key: 'brake_test', label: 'Brake function test', critical: true },
      { key: 'park_brake', label: 'Park brake working', critical: true },
    ],
  },
  {
    id: 'exterior',
    title: 'Exterior Damage',
    items: [
      { key: 'body_damage', label: 'No visible body damage', critical: false },
      { key: 'clean', label: 'Is the vehicle clean?', critical: false },
      { key: 'windscreen', label: 'Windscreen intact', critical: true },
      { key: 'mirrors', label: 'Mirrors intact and clean', critical: false },
    ],
  },
];

export default function PreStartChecklistScreen(props: ScreenProps<'PreStartChecklist'>) {
  const { navigation } = props;
  const { submitPreStartChecklist, updateAppState } = useAppState();
  const vehicleId = props.route.params?.vehicleId ?? null;
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(initialExpandedState);
  const [checklist, setChecklist] = useState<Record<ChecklistKey, ChecklistValue>>({
    ...initialChecklistState,
  });
  const [notes, setNotes] = useState<Record<ChecklistKey, string>>(initialNotesState);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checklistAnswers = useMemo(() => {
    return checklistSections.flatMap(section =>
      section.items.map(item => ({
        id: item.key,
        label: item.label,
        status: checklist[item.key],
        note: notes[item.key],
        critical: item.critical,
        sectionTitle: section.title,
      }))
    );
  }, [checklist, notes]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const setCheck = (key: ChecklistKey, value: 'pass' | 'fail') => {
    setChecklist(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateItemNote = (key: ChecklistKey, note: string) => {
    setNotes(prev => ({
      ...prev,
      [key]: note,
    }));
  };

  const allAnswered = Object.values(checklist).every(value => value !== null);
  const hasFail = Object.values(checklist).includes('fail');
  const hasCriticalFailures = checklistSections.some(section =>
    section.items.some(item => checklist[item.key] === 'fail' && item.critical)
  );
  const failedItemsHaveNotes = checklistAnswers.every(
    item => item.status !== 'fail' || item.note.trim().length > 0
  );
  const canSubmit = allAnswered && failedItemsHaveNotes && !isSubmitting && Boolean(vehicleId);

  const submitChecklist = async () => {
    if (isSubmitting) return;

    if (!allAnswered) {
      Alert.alert('Complete all checks', 'Please answer every inspection item before continuing.');
      return;
    }

    if (!failedItemsHaveNotes) {
      Alert.alert('Add failure notes', 'Please describe the issue for each failed check.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    const result = await submitPreStartChecklist({
      answers: checklistAnswers,
      hasFailures: hasFail,
      hasCriticalFailures,
      assignmentVehicleId: vehicleId,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setSubmissionError(result.error ?? 'Unable to submit checklist.');
      return;
    }

    Alert.alert(
      'Checklist saved',
      hasFail
        ? 'Checklist saved locally with issues. You can continue to readings.'
        : 'Checklist saved locally.'
    );

    if (hasCriticalFailures) {
      navigation.navigate('WaitForInstruction');
    } else {
      navigation.navigate('ReadingsAndPhotos', { checklistAnswers });
    }
  };

  const saveDraft = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);
    updateAppState({
      preStartChecklistAnswers: checklistAnswers,
      checklistCompleted: false,
      checklistSubmitted: false,
    });
    setIsSubmitting(false);
    Alert.alert('Draft saved', 'Your checklist draft was saved on this device for this session.');
  };

  return (
    <ScreenContainer title="Vehicle Checklist" subtitle="Complete the pre-start vehicle inspection">
      {!vehicleId ? (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>Missing vehicle selection. Return to assignment to continue.</Text>
          <Button label="Back to assignment" variant="ghost" onPress={() => navigation.replace('VehicleAssignment')} />
        </View>
      ) : null}

      {hasFail && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>Failed items will notify operations</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {checklistSections.map(section => (
          <View key={section.id} style={styles.sectionCard}>
            <Pressable onPress={() => toggleSection(section.id)} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionToggle}>{expandedSections[section.id] ? '-' : '+'}</Text>
            </Pressable>

            {expandedSections[section.id] && (
              <View style={styles.sectionBody}>
                {section.items.map(item => (
                  <View key={item.key} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.itemButtons}>
                      <Pressable
                        onPress={() => setCheck(item.key, 'pass')}
                        style={[
                          styles.smallBtn,
                          checklist[item.key] === 'pass' ? styles.passActive : styles.passInactive,
                        ]}
                      >
                        <Text
                          style={
                            checklist[item.key] === 'pass'
                              ? styles.smallBtnTextActive
                              : styles.smallBtnTextInactive
                          }
                        >
                          Pass
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setCheck(item.key, 'fail')}
                        style={[
                          styles.smallBtn,
                          checklist[item.key] === 'fail' ? styles.failActive : styles.failInactive,
                        ]}
                      >
                        <Text
                          style={
                            checklist[item.key] === 'fail'
                              ? styles.smallBtnTextActive
                              : styles.smallBtnTextInactive
                          }
                        >
                          Fail
                        </Text>
                      </Pressable>
                    </View>

                    {checklist[item.key] === 'fail' && (
                      <TextInput
                        placeholder="Required: Describe the issue"
                        value={notes[item.key]}
                        onChangeText={text => updateItemNote(item.key, text)}
                        multiline
                        style={styles.noteInput}
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {submissionError ? <Text style={styles.errorText}>{submissionError}</Text> : null}

      <View style={styles.footer}>
        <Button label="Save Draft" variant="ghost" onPress={saveDraft} disabled={isSubmitting || !vehicleId} />
        <Button
          label={isSubmitting ? 'Submitting...' : 'Submit Checklist'}
          onPress={submitChecklist}
          disabled={!canSubmit || isSubmitting || !vehicleId}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  alertBox: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
    padding: 12,
    marginBottom: 8,
  },
  alertText: {
    color: '#2E2E2E',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionToggle: {
    color: '#9E9E9E',
    fontSize: 18,
  },
  sectionBody: {
    marginTop: 8,
    gap: 8,
  },
  itemRow: {
    marginBottom: 8,
  },
  itemLabel: {
    color: '#2E2E2E',
    marginBottom: 6,
  },
  itemButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 6,
  },
  passActive: {
    backgroundColor: '#66BB6A',
  },
  passInactive: {
    backgroundColor: '#F2F2F2',
  },
  failActive: {
    backgroundColor: '#D32F2F',
  },
  failInactive: {
    backgroundColor: '#F2F2F2',
  },
  smallBtnTextActive: {
    color: '#FFFFFF',
  },
  smallBtnTextInactive: {
    color: '#9E9E9E',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#D32F2F',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    minHeight: 56,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 8,
  },
});
