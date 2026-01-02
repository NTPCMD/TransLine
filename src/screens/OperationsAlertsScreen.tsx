import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

const alerts = [
  'High wind warning on coastal routes.',
  'Expect delays at port entry between 3-5pm.',
  'Check tyre pressures after long highway sections.',
];

export default function OperationsAlertsScreen({ navigation }: ScreenProps<'OperationsAlerts'>) {
  return (
    <ScreenContainer title="Operations alerts" subtitle="Live notices from operations">
      <View style={styles.card}>
        {alerts.map(item => (
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
