import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import { useActiveAssignment } from '../state/AssignmentContext';
import { getGpsFix } from '../lib/locationEvents';
import type { ScreenProps } from '../types/navigation';

export default function ReadingsAndPhotosScreen(props: ScreenProps<'ReadingsAndPhotos'>) {
  const { navigation } = props;
  const { state, startShift, updateAppState } = useAppState();
  const [reading, setReading] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startWarning, setStartWarning] = useState<string | null>(null);

  const { status, vehicle, refresh } = useActiveAssignment();

  const showRefreshAssignment = status !== 'loading' && !vehicle;
  const hasPhoto = Boolean(photoUri);
  const hasReading = Boolean(reading.trim());
  const canContinue = hasReading && hasPhoto && !isSaving;

  const vehicleLabel = vehicle?.rego
    ? `${vehicle.rego}${vehicle.make || vehicle.model ? ` — ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}` : ''}`
    : null;

  const ensureStartOdometerGps = async () => {
    if (state.startOdometerLat !== null && state.startOdometerLng !== null) {
      return {
        capturedAt: state.startOdometerCapturedAt ?? new Date().toISOString(),
        lat: state.startOdometerLat,
        lng: state.startOdometerLng,
        accuracy: state.startOdometerAccuracy,
      };
    }

    try {
      const fix = await getGpsFix();
      const capturedAt = new Date().toISOString();
      updateAppState({
        startOdometerCapturedAt: capturedAt,
        startOdometerLat: fix.latitude,
        startOdometerLng: fix.longitude,
        startOdometerAccuracy: fix.accuracy,
        shiftStartTime: state.shiftStartTime ?? new Date(capturedAt),
      });
      return { capturedAt, lat: fix.latitude, lng: fix.longitude, accuracy: fix.accuracy };
    } catch (e) {
      setStartError('Location is required. Please allow Location access and try again.');
      return null;
    }
  };

  const handleContinue = async () => {
    console.log('[StartShift] continue pressed');
    setAttemptedSubmit(true);
    setStartError(null);
    setStartWarning(null);

    if (isSaving) {
      setStartError('Shift start is already in progress.');
      return;
    }

    if (!reading.trim() || !photoUri) {
      setStartError('Enter the odometer reading and capture the odometer photo to continue.');
      return;
    }

    if (!vehicle) {
      setStartError('No active vehicle assignment. Refresh assignment to continue.');
      return;
    }

    const odometerValue = Number(reading);
    if (!Number.isInteger(odometerValue) || odometerValue < 0) {
      setStartError('Odometer value must be a valid whole number.');
      return;
    }

    const gps = await ensureStartOdometerGps();
    if (!gps) return;

    console.log('[StartShift] validation passed', {
      odometerValue,
      hasPhoto: Boolean(photoUri),
      vehicleId: vehicle.id,
    });

    updateAppState({ odometerReading: reading, odometerPhoto: photoUri });

    setIsSaving(true);
    try {
      console.log('[StartShift] calling startShift');
      const { shiftId, error, queued } = await startShift({
        odometerReading: reading,
        odometerPhoto: photoUri,
        capturedAt: gps.capturedAt,
        location: { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy },
      });

      console.log('[StartShift] startShift result', {
        shiftId: shiftId ?? null,
        shiftIdType: typeof shiftId,
        queued: queued ?? false,
        error: error ?? null,
      });

      if (error) {
        throw new Error(error);
      }

      if (typeof shiftId !== 'string' || shiftId.trim().length === 0) {
        throw new Error('Start shift returned an invalid shift id.');
      }

      if (!shiftId) {
        throw new Error(error ?? 'Unable to start shift.');
      }

      if (queued) {
        setStartWarning('Odometer captured offline. It will sync when you are online.');
      }

      console.log('[StartShift] navigating ActiveShift');
      navigation.reset({ index: 0, routes: [{ name: 'ActiveShift' }] });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save odometer reading.';
      Alert.alert('Save failed', message, [{ text: 'OK' }]);
      setStartError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer title="Readings & photos" subtitle="Capture odometer before departure">
      <TextField
        label="Odometer reading"
        value={reading}
        onChangeText={setReading}
        keyboardType="numeric"
        placeholder="Enter the odometer reading"
      />

      <PhotoPicker
        label="Odometer photo (required)"
        uri={photoUri}
        onChange={(uri) => {
          setPhotoUri(uri);
          updateAppState({ odometerPhoto: uri ?? '' });
          if (!uri) {
            updateAppState({
              odometerPhoto: '',
              startOdometerCapturedAt: null,
              startOdometerLat: null,
              startOdometerLng: null,
              startOdometerAccuracy: null,
            });
          }
        }}
        cameraOnly
        onCaptureMeta={(meta) => {
          if (meta.locationDenied) {
            setStartError('Location denied. Please allow Location in settings and try again.');
          } else {
            setStartError(null);
          }
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
      ) : vehicleLabel ? (
        <Text style={{ marginTop: 8, color: '#111827' }}>Vehicle: {vehicleLabel}</Text>
      ) : (
        <Text style={{ color: '#D32F2F', marginTop: 8 }}>No active vehicle assignment. Refresh assignment.</Text>
      )}

      {showRefreshAssignment ? (
        <Button label="Refresh assignment" variant="ghost" onPress={() => refresh(true)} />
      ) : null}

      {attemptedSubmit && !reading.trim() ? (
        <Text style={{ color: '#D32F2F' }}>Odometer value is required.</Text>
      ) : null}
      {attemptedSubmit && !photoUri ? (
        <Text style={{ color: '#D32F2F' }}>Odometer photo is required.</Text>
      ) : null}
      {isSaving ? (
        <Text style={{ color: '#6B7280' }}>Starting shift...</Text>
      ) : null}
      {startError ? (
        <Text style={{ color: '#D32F2F' }}>{startError}</Text>
      ) : null}
      {startWarning ? (
        <Text style={{ color: '#F59E0B' }}>{startWarning}</Text>
      ) : null}

      <Button label="Continue" onPress={handleContinue} disabled={!canContinue} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
