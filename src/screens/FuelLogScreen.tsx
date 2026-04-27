import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

type GpsCaptureState =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'ready'; latitude: number; longitude: number; accuracy: number | null; capturedAt: string }
  | { status: 'denied' }
  | { status: 'failed'; message: string };

type ReadyGps = Extract<GpsCaptureState, { status: 'ready' }>;

export default function FuelLogScreen(props: ScreenProps<'FuelLog'>) {
  const { navigation } = props;
  const { createEvent, updateAppState, state } = useAppState();
  const [litres, setLitres] = useState('');
  const [cost, setCost] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [location, setLocation] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gps, setGps] = useState<GpsCaptureState>({ status: 'idle' });

  const captureGps = useCallback(async (): Promise<ReadyGps | null> => {
    setGps({ status: 'fetching' });

    let permStatus: Location.PermissionStatus;
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        permStatus = requested.status;
      } else {
        permStatus = existing.status;
      }
    } catch {
      setGps({ status: 'failed', message: 'Could not check location permission.' });
      return null;
    }

    if (permStatus !== 'granted') {
      setGps({ status: 'denied' });
      return null;
    }

    try {
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const readyGps: ReadyGps = {
        status: 'ready',
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy ?? null,
        capturedAt: new Date().toISOString(),
      };
      setGps(readyGps);
      return readyGps;
    } catch (err: any) {
      setGps({
        status: 'failed',
        message: err?.message ?? 'GPS fix failed. Please try again.',
      });
      return null;
    }
  }, []);

  useEffect(() => {
    void captureGps();
  }, [captureGps]);

  const submitFuel = async () => {
    setAttemptedSubmit(true);

    if (!litres || !cost || !odometerKm || !location || !receiptUri) {
      return;
    }

    const capturedGps = gps.status === 'ready' ? gps : await captureGps();
    if (!capturedGps) {
      return;
    }

    setIsSubmitting(true);
    try {
      const capturedAt = capturedGps.capturedAt;

      const result = await createEvent(
        'fuel_log',
        {
          litres: Number(litres),
          cost: Number(cost),
          odometer_km: Number(odometerKm),
          receipt_urls: [receiptUri],
          location_name: location,
          accuracy: capturedGps.accuracy,
          captured_at: capturedAt,
          driver_id: state.driverRecordId ?? null,
          vehicle_id: state.vehicleId ?? state.activeShiftVehicleId ?? null,
          shift_id: state.activeShiftId ?? null,
        },
        {
          locationOverride: {
            latitude: capturedGps.latitude,
            longitude: capturedGps.longitude,
          },
        }
      );

      if (result.status === 'error') {
        Alert.alert('Submission failed', result.error ?? 'Could not save fuel log.');
        return;
      }

      updateAppState({ lastFueled: capturedAt });
      Alert.alert(
        result.status === 'queued' ? 'Queued for sync' : 'Fuel logged',
        result.status === 'queued'
          ? 'No connection — fuel log will sync when you are back online.'
          : 'Your fuel entry has been saved.',
      );
      navigation.goBack();
    } finally {
      setIsSubmitting(false);
    }
  };

  const gpsLabel = () => {
    switch (gps.status) {
      case 'idle': return null;
      case 'fetching': return { text: 'Getting location…', color: '#1D4ED8' };
      case 'ready': return {
        text: `📍 ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}${gps.accuracy !== null ? ` (±${Math.round(gps.accuracy)}m)` : ''}`,
        color: '#166534',
      };
      case 'denied': return {
        text: 'Location permission denied. Please enable in device settings and retry.',
        color: '#B91C1C',
      };
      case 'failed': return { text: `GPS failed: ${gps.message}`, color: '#B91C1C' };
    }
  };

  const label = gpsLabel();

  return (
    <ScreenContainer title="Fuel log" subtitle="Record fuel stops during your shift">
      <TextField label="Litres" value={litres} onChangeText={setLitres} keyboardType="numeric" placeholder="0" />
      <TextField label="Cost" value={cost} onChangeText={setCost} keyboardType="numeric" placeholder="$0.00" />
      <TextField
        label="Odometer (km)"
        value={odometerKm}
        onChangeText={setOdometerKm}
        keyboardType="numeric"
        placeholder="0"
      />
      <TextField label="Location" value={location} onChangeText={setLocation} placeholder="Fuel station" />

      <PhotoPicker label="Receipt photo (required)" uri={receiptUri} onChange={setReceiptUri} cameraOnly />
      {attemptedSubmit && !receiptUri && (
        <Text style={styles.errorText}>Receipt photo is required.</Text>
      )}

      <View style={styles.gpsRow}>
        <Button
          label={gps.status === 'fetching' ? 'Getting location…' : gps.status === 'ready' ? 'Retake location' : 'Capture GPS location'}
          variant="secondary"
          onPress={captureGps}
          disabled={gps.status === 'fetching' || isSubmitting}
        />
        {label && (
          <Text style={[styles.gpsStatus, { color: label.color }]} numberOfLines={3}>
            {label.text}
          </Text>
        )}
        {attemptedSubmit && gps.status !== 'ready' && (
          <Text style={styles.errorText}>
            GPS location is required. {gps.status === 'denied' ? 'Check device settings.' : 'Tap "Capture GPS location" to retry.'}
          </Text>
        )}
      </View>

      <Button
        label={isSubmitting ? 'Saving…' : 'Submit'}
        onPress={submitFuel}
        disabled={isSubmitting}
      />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} disabled={isSubmitting} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gpsRow: {
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  gpsStatus: {
    fontSize: 13,
    marginTop: 4,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 2,
  },
});
