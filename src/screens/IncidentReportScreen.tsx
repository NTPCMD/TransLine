import React, { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

export default function IncidentReportScreen({ navigation }: ScreenProps<'IncidentReport'>) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    if (!title || !details) {
      Alert.alert('Missing details', 'Please provide a title and description.');
      return;
    }
    Alert.alert('Incident submitted', 'The operations team has been notified.');
    navigation.goBack();
  };

  return (
    <ScreenContainer title="Incident report" subtitle="Log an incident for operations">
      <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Short summary" />
      <TextField
        label="Description"
        value={details}
        onChangeText={setDetails}
        placeholder="Describe what happened"
        multiline
      />
      <Button label="Submit report" onPress={handleSubmit} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
