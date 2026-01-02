import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

interface Entry {
  id: string;
  note: string;
}

export default function VehicleMaintenanceLogScreen({ navigation }: ScreenProps<'VehicleMaintenanceLog'>) {
  const [entries, setEntries] = useState<Entry[]>([
    { id: '1', note: 'Tyre pressure checked' },
    { id: '2', note: 'Washer fluid topped up' },
  ]);
  const [note, setNote] = useState('');

  const addEntry = () => {
    if (!note) {
      return;
    }
    setEntries(prev => [...prev, { id: String(prev.length + 1), note }]);
    setNote('');
  };

  return (
    <ScreenContainer title="Maintenance log" subtitle="Track vehicle upkeep items">
      <View style={styles.card}>
        <FlatList
          data={entries}
          scrollEnabled={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <Text style={styles.item}>• {item.note}</Text>}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
      <TextField label="New entry" value={note} onChangeText={setNote} placeholder="Describe maintenance" />
      <Button label="Add entry" onPress={addEntry} />
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
  },
  item: {
    color: '#111827',
    lineHeight: 20,
    paddingVertical: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
});
