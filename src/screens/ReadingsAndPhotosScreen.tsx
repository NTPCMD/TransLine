import React, { useState } from 'react';
import { Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function ReadingsAndPhotosScreen({ navigation }: ScreenProps<'ReadingsAndPhotos'>) {
  const { startShift, updateAppState } = useAppState();
  const [reading, setReading] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const handleContinue = async () => {
    setAttemptedSubmit(true);
    setStartError(null);
    if (!reading.trim() || !photoUri) {
      // Inline errors will show; prevent navigation
      return;
    }

    updateAppState({
      odometerReading: reading,
      odometerPhoto: photoUri,
      shiftStartTime: new Date(),
    });
    const { shiftId, error } = await startShift();
    if (!shiftId) {
      setStartError(error ?? 'Unable to start shift.');
      return;
    }
    updateAppState({ shiftStarted: true });
    // After readings, navigate to main drawer home (dashboard)
    navigation.replace('Main');
  };

  return (
    <ScreenContainer title="Readings & photos" subtitle="Capture odometer before departure">
      <TextField
        label="Odometer reading"
        value={reading}
        onChangeText={setReading}
        keyboardType="numeric"
        placeholder="Enter the odometer"
      />

      <PhotoPicker label="Odometer photo (required)" uri={photoUri} onChange={setPhotoUri} />

      {attemptedSubmit && !reading.trim() ? (
        <Text style={{ color: '#D32F2F' }}>Odometer value is required.</Text>
      ) : null}
      {attemptedSubmit && !photoUri ? (
        <Text style={{ color: '#D32F2F' }}>Odometer photo is required.</Text>
      ) : null}
      {startError ? <Text style={{ color: '#D32F2F' }}>{startError}</Text> : null}

      <Button label="Continue" onPress={handleContinue} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
