import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

const components = [
  'PPE checklist',
  'Load restraint guide',
  'Fatigue calculator',
  'Training videos',
];

export default function ComponentsLibraryScreen(props: ScreenProps<'ComponentsLibrary'>) {
  const { navigation } = props;
  return (
    <ScreenContainer title="Components library" subtitle="Helpful resources for drivers">
      <View style={styles.card}>
        {components.map(item => (
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
