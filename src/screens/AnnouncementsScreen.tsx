import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

const announcements = [
  'New fatigue management policy starts Monday.',
  'Mandatory PPE checks before warehouse entry.',
  'Remember to upload receipts after fuel stops.',
];

export default function AnnouncementsScreen({ navigation }: ScreenProps<'Announcements'>) {
  return (
    <ScreenContainer title="Announcements" subtitle="Latest operations updates">
      <View style={styles.card}>
        {announcements.map(item => (
          <Text key={item} style={styles.item}>
            • {item}
          </Text>
        ))}
      </View>
      <Button label="Back" onPress={() => navigation.goBack()} />
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
    gap: 8,
  },
  item: {
    color: '#111827',
    lineHeight: 20,
  },
});
