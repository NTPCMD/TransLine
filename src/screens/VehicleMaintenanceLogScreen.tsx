import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

interface Entry {
  id: string;
  note: string;
}

export default function VehicleMaintenanceLogScreen({ navigation }: ScreenProps<'VehicleMaintenanceLog'>) {
  const { state } = useAppState();
  const entries: Entry[] = [
    { id: '1', note: 'Tyre pressure checked' },
    { id: '2', note: 'Washer fluid topped up' },
  ];

  return (
    <ScreenContainer title="Maintenance log" subtitle="Driver view (read-only)">
      <View style={styles.card}>
        <FlatList
          data={entries}
          scrollEnabled={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <Text style={styles.item}>• {item.note}</Text>}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.item}>Last fuelled: {state.lastFueled ? new Date(state.lastFueled).toLocaleString() : 'No record'}</Text>
      </View>

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
