import React, { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

export default function MedicalAbsenceScreen({ navigation }: ScreenProps<'MedicalAbsence'>) {
  const [reason, setReason] = useState('');

  const submit = () => {
    if (!reason) {
      Alert.alert('Add a reason', 'Please describe the medical situation.');
      return;
    }
    Alert.alert('Submitted', 'Your medical absence has been logged.');
    navigation.goBack();
  };

  return (
    <ScreenContainer title="Medical absence" subtitle="Log a medical incident">
      <TextField label="Reason" value={reason} onChangeText={setReason} placeholder="Describe the situation" multiline />
      <Button label="Submit" onPress={submit} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
