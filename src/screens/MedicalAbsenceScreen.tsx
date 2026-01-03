import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import type { ScreenProps } from '../types/navigation';

export default function MedicalAbsenceScreen({ navigation }: ScreenProps<'MedicalAbsence'>) {
  const [reason, setReason] = useState('');
  const [certificateUri, setCertificateUri] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const submit = () => {
    setAttemptedSubmit(true);
    if (!reason || !certificateUri) {
      return;
    }
    Alert.alert('Submitted', 'Your medical absence has been logged.');
    navigation.goBack();
  };

  return (
    <ScreenContainer title="Medical absence" subtitle="Log a medical incident">
      <TextField label="Reason" value={reason} onChangeText={setReason} placeholder="Describe the situation" multiline />

      <PhotoPicker label="Medical certificate (required)" uri={certificateUri} onChange={setCertificateUri} />
      {attemptedSubmit && !certificateUri ? (
        <Text style={{ color: '#D32F2F' }}>Medical certificate photo is required.</Text>
      ) : null}

      <Button label="Submit" onPress={submit} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
