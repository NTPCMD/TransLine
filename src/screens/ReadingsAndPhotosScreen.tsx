import React, { useState } from 'react';
import { Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import { useActiveAssignment } from '../state/AssignmentContext';
import type { ScreenProps } from '../types/navigation';

export default function ReadingsAndPhotosScreen({ navigation }: ScreenProps<'ReadingsAndPhotos'>) {
  const { state, startShift, updateAppState } = useAppState();
  const [reading, setReading] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startWarning, setStartWarning] = useState<string | null>(null);

  const { status, vehicle } = useActiveAssignment();

  React.useEffect(() => {
    console.log('assignment status', status, vehicle);
    console.log('odometer screen vehicle_id', vehicle?.id);
  }, [status, vehicle]);

  const handleContinue = async () => {
    setAttemptedSubmit(true);
    setStartError(null);
    setStartWarning(null);
    console.log('start shift submit pressed', { status, vehicleId: vehicle?.id });
    if (!reading.trim() || !photoUri) {
      // Inline errors will show; prevent navigation
      return;
    }

    if (!vehicle) {
      setStartError('No vehicle assigned. Contact admin.');
      return;
    }

    if (!state.checklistSubmitted) {
      setStartError('Complete the checklist before capturing the odometer.');
      return;
    }

    const odometerValue = Number(reading);
    if (!Number.isInteger(odometerValue) || odometerValue < 0) {
      setStartError('Odometer value must be a valid whole number.');
      return;
    }

    updateAppState({
      odometerReading: reading,
      odometerPhoto: photoUri,
    });
    const { shiftId, error, queued } = await startShift();
    console.log('start shift response', { shiftId, error, queued });
    if (!shiftId) {
      setStartError(error ?? 'Unable to start shift.');
      return;
    }
    if (queued) {
      setStartWarning('Odometer captured offline. It will sync when you are online.');
    }
    updateAppState({ shiftStarted: true });
    // After readings, navigate to main drawer home (dashboard)
    navigation.replace('Main');
    console.log('navigation to Main after start shift');
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

      <PhotoPicker
        label="Odometer photo (required)"
        uri={photoUri}
        onChange={(uri) => {
          setPhotoUri(uri);
          if (!uri) {
            updateAppState({
              startOdometerCapturedAt: null,
              startOdometerLat: null,
              startOdometerLng: null,
              startOdometerAccuracy: null,
            });
          }
        }}
        cameraOnly
        onCaptureMeta={(meta) => {
          updateAppState({
            startOdometerCapturedAt: meta.capturedAt,
            startOdometerLat: meta.location.lat,
            startOdometerLng: meta.location.lng,
            startOdometerAccuracy: meta.location.accuracy,
            shiftStartTime: new Date(meta.capturedAt),
          });
        }}
      />

      {status === 'loading' ? (
        <Text style={{ marginTop: 8, color: '#6B7280' }}>Loading vehicle assignment...</Text>
      ) : vehicle ? (
        <Text style={{ marginTop: 8 }}>
          Vehicle: {vehicle.registration ?? vehicle.rego ?? vehicle.plate_number ?? vehicle.name ?? 'Unknown registration'}
        </Text>
      ) : (
        <Text style={{ color: '#D32F2F', marginTop: 8 }}>No vehicle assigned. Contact admin.</Text>
      )}

      {attemptedSubmit && !reading.trim() ? (
        <Text style={{ color: '#D32F2F' }}>Odometer value is required.</Text>
      ) : null}
      {attemptedSubmit && !photoUri ? (
        <Text style={{ color: '#D32F2F' }}>Odometer photo is required.</Text>
      ) : null}
      {startError ? <Text style={{ color: '#D32F2F' }}>{startError}</Text> : null}
      {startWarning ? <Text style={{ color: '#F59E0B' }}>{startWarning}</Text> : null}

      <Button
        label="Continue"
        onPress={handleContinue}
        disabled={status === 'loading' || !vehicle || !reading.trim() || !photoUri || !state.checklistSubmitted}
      />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
