import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

type ChecklistItem = {
  id: string;
  label: string;
  status: 'pass' | 'fail' | null;
  note: string;
  critical: boolean;
};

type ChecklistSection = {
  id: string;
  title: string;
  items: ChecklistItem[];
  expanded: boolean;
};

const initialSections: ChecklistSection[] = [
  {
    id: 'tyres',
    title: 'Tyres & Wheels',
    expanded: true,
    items: [
      { id: 'tyre-pressure', label: 'Tyre pressure adequate', status: null, note: '', critical: false },
      { id: 'tyre-tread', label: 'Tread depth acceptable', status: null, note: '', critical: true },
      { id: 'wheel-nuts', label: 'Wheel nuts secure', status: null, note: '', critical: true },
    ],
  },
  {
    id: 'lights',
    title: 'Lights & Indicators',
    expanded: false,
    items: [
      { id: 'headlights', label: 'Headlights working', status: null, note: '', critical: true },
      { id: 'indicators', label: 'Indicators working', status: null, note: '', critical: true },
      { id: 'brake-lights', label: 'Brake lights working', status: null, note: '', critical: true },
    ],
  },
  {
    id: 'fluids',
    title: 'Fluids',
    expanded: false,
    items: [
      { id: 'engine-oil', label: 'Engine oil level', status: null, note: '', critical: true },
      { id: 'coolant', label: 'Coolant level', status: null, note: '', critical: true },
      { id: 'washer-fluid', label: 'Washer fluid', status: null, note: '', critical: false },
    ],
  },
  {
    id: 'brakes',
    title: 'Brakes',
    expanded: false,
    items: [
      { id: 'brake-function', label: 'Brake function test', status: null, note: '', critical: true },
      { id: 'park-brake', label: 'Park brake working', status: null, note: '', critical: true },
    ],
  },
  {
    id: 'exterior',
    title: 'Exterior Damage',
    expanded: false,
    items: [
      { id: 'body-damage', label: 'No visible body damage', status: null, note: '', critical: false },
      { id: 'windscreen', label: 'Windscreen intact', status: null, note: '', critical: true },
      { id: 'mirrors', label: 'Mirrors intact and clean', status: null, note: '', critical: false },
    ],
  },
];

export default function PreStartChecklistScreen({ navigation }: ScreenProps<'PreStartChecklist'>) {
  const { updateAppState } = useAppState();
  const [sections, setSections] = useState<ChecklistSection[]>(initialSections);

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(s => (s.id === sectionId ? { ...s, expanded: !s.expanded } : s)));
  };

  const updateItemStatus = (sectionId: string, itemId: string, status: 'pass' | 'fail') => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, items: section.items.map(item => (item.id === itemId ? { ...item, status } : item)) }
        : section
    ));
  };

  const updateItemNote = (sectionId: string, itemId: string, note: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, items: section.items.map(item => (item.id === itemId ? { ...item, note } : item)) }
        : section
    ));
  };

  const hasFailedItems = sections.some(section => section.items.some(item => item.status === 'fail'));
  const hasCriticalFailures = sections.some(section => section.items.some(item => item.status === 'fail' && item.critical));
  const allItemsCompleted = sections.every(section => section.items.every(item => item.status !== null));
  const failedItemsHaveNotes = sections.every(section => section.items.every(item => item.status !== 'fail' || (item.status === 'fail' && item.note.trim() !== '')));
  const canSubmit = allItemsCompleted && failedItemsHaveNotes;

  const submitChecklist = () => {
    updateAppState({ checklistCompleted: !hasFailedItems });
    if (hasCriticalFailures) {
      navigation.navigate('WaitForInstruction');
    } else {
      navigation.navigate('ReadingsAndPhotos');
    }
  };

  return (
    <ScreenContainer title="Vehicle Checklist" subtitle="Complete the pre-start vehicle inspection">
      {hasFailedItems && (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>Failed items will notify operations</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {sections.map(section => (
          <View key={section.id} style={styles.sectionCard}>
            <Pressable onPress={() => toggleSection(section.id)} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionToggle}>{section.expanded ? '-' : '+'}</Text>
            </Pressable>

            {section.expanded && (
              <View style={styles.sectionBody}>
                {section.items.map(item => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                    </View>
                    <View style={styles.itemButtons}>
                      <Pressable
                        onPress={() => updateItemStatus(section.id, item.id, 'pass')}
                        style={[styles.smallBtn, item.status === 'pass' ? styles.passActive : styles.passInactive]}
                      >
                        <Text style={item.status === 'pass' ? styles.smallBtnTextActive : styles.smallBtnTextInactive}>Pass</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => updateItemStatus(section.id, item.id, 'fail')}
                        style={[styles.smallBtn, item.status === 'fail' ? styles.failActive : styles.failInactive]}
                      >
                        <Text style={item.status === 'fail' ? styles.smallBtnTextActive : styles.smallBtnTextInactive}>Fail</Text>
                      </Pressable>
                    </View>

                    {item.status === 'fail' && (
                      <TextInput
                        placeholder="Required: Describe the issue"
                        value={item.note}
                        onChangeText={text => updateItemNote(section.id, item.id, text)}
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

      <View style={styles.footer}>
        <Button label="Save Draft" variant="outline" onPress={() => navigation.goBack()} />
        <Button label="Submit Checklist" onPress={submitChecklist} disabled={!canSubmit} />
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
});
