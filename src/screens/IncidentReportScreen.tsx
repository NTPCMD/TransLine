import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

const severityOptions = ['Low', 'Medium', 'High'] as const;

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
      <View style={styles.severityContainer}>
        <Text style={styles.severityLabel}>Severity</Text>
        <View style={styles.severityRow}>
          {severityOptions.map(option => (
            <Button
              key={option}
              label={option}
              variant={severity === option ? 'primary' : 'secondary'}
              onPress={() => setSeverity(option)}
              style={styles.severityButton}
            />
          ))}
        </View>
      </View>
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

const styles = StyleSheet.create({
  severityContainer: {
    width: '100%',
    marginBottom: 12,
  },
  severityLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    flex: 1,
  },
});
