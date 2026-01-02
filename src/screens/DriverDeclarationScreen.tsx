import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function DriverDeclarationScreen({ navigation }: ScreenProps<'DriverDeclaration'>) {
  const { updateAppState } = useAppState();

  const handleAccept = () => {
    updateAppState({
      declarationAccepted: true,
      assignedVehicle: {
        registration: 'ABC-123',
        type: 'Rigid Truck',
        depot: 'Sydney Depot',
      },
    });
    navigation.replace('StartShift');
  };

  return (
    <ScreenContainer title="Driver declaration" subtitle="Review and accept the compliance statement">
      <View style={styles.card}>
        <Text style={styles.text}>
          I confirm that I am fit for duty, have completed my fatigue management requirements, and will operate my vehicle in
          accordance with company policy.
        </Text>
        <Text style={styles.text}>
          I will report any incidents immediately and follow operational instructions from the operations centre.
        </Text>
      </View>
      <Button label="I agree and continue" onPress={handleAccept} />
      <Button label="Back to login" variant="ghost" onPress={() => navigation.replace('Login')} />
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
  text: {
    color: '#111827',
    lineHeight: 20,
  },
});
