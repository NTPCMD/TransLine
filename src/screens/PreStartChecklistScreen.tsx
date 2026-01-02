import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

const checklistItems = [
  'Vehicle walkaround complete',
  'Brakes tested',
  'Lights and indicators operational',
  'Load securement checked',
];

export default function PreStartChecklistScreen({ navigation }: ScreenProps<'PreStartChecklist'>) {
  const { updateAppState } = useAppState();
  const [responses, setResponses] = useState<Record<string, boolean>>({});

  const updateItem = (item: string, value: boolean) => {
    setResponses(prev => ({ ...prev, [item]: value }));
  };

  const submitChecklist = () => {
    const hasFails = checklistItems.some(item => !responses[item]);
    updateAppState({ checklistCompleted: !hasFails });
    if (hasFails) {
      navigation.navigate('WaitForInstruction');
    } else {
      navigation.navigate('ReadingsAndPhotos');
    }
  };

  return (
    <ScreenContainer title="Pre-start checklist" subtitle="Confirm vehicle readiness before departure">
      <View style={styles.card}>
        {checklistItems.map(item => (
          <View key={item} style={styles.row}>
            <Text style={styles.itemText}>{item}</Text>
            <Switch value={responses[item]} onValueChange={value => updateItem(item, value)} />
          </View>
        ))}
      </View>
      <Button label="Submit checklist" onPress={submitChecklist} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
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
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemText: {
    flex: 1,
    color: '#111827',
    marginRight: 12,
  },
});
