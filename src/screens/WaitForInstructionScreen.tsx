import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

export default function WaitForInstructionScreen({ navigation }: ScreenProps<'WaitForInstruction'>) {
  return (
    <ScreenContainer title="Awaiting instructions" subtitle="Your checklist flagged an issue">
      <View style={styles.card}>
        <Text style={styles.message}>
          An alert has been sent to the operations centre. Please wait for a call back or contact them directly.
        </Text>
      </View>
      <Button label="Call operations" onPress={() => Alert.alert('Contact', 'Calling operations centre...')} />
      <Button label="Send a note" variant="secondary" onPress={() => navigation.navigate('SendNote')} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FACC15',
  },
  message: {
    color: '#854D0E',
    lineHeight: 20,
  },
});
