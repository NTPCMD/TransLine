import React, { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function IncidentReportScreen(props: ScreenProps<'IncidentReport'>) {
  const { navigation } = props;
  const { createEvent } = useAppState();
  const [severity, setSeverity] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!severity || !title || !details) {
      Alert.alert('Missing details', 'Please provide severity, title, and description.');
      return;
    }
    await createEvent('incident', {
      severity,
      title,
      description: details,
      photo_urls: photoUri ? [photoUri] : [],
    });
    Alert.alert('Incident submitted', 'The operations team has been notified.');
    navigation.goBack();
  };

  return (
    <ScreenContainer title="Incident report" subtitle="Log an incident for operations">
      <TextField label="Severity" value={severity} onChangeText={setSeverity} placeholder="Low, medium, high" />
      <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Short summary" />
      <TextField
        label="Description"
        value={details}
        onChangeText={setDetails}
        placeholder="Describe what happened"
        multiline
      />
      <PhotoPicker label="Photo (optional)" uri={photoUri} onChange={setPhotoUri} />
      <Button label="Submit report" onPress={handleSubmit} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
