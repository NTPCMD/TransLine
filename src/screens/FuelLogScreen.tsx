import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import { uploadFuelReceipt } from '../lib/photoUpload';
import { supabase } from '../lib/supabase';
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
  const [submitError, setSubmitError] = useState<string | null>(null);
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

  const resolveActiveShiftForFuelLog = async (authUserId: string) => {
    if (state.activeShiftId) {
      return {
        shiftId: state.activeShiftId,
        driverId: state.driverRecordId ?? null,
        vehicleId: state.activeShiftVehicleId ?? state.vehicleId ?? null,
      };
    }

    let driverId = state.driverRecordId;
    if (!driverId) {
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (driverError || !driver?.id) {
        return {
          shiftId: null as string | null,
          driverId: null as string | null,
          vehicleId: null as string | null,
          error: 'Driver profile not available.',
        };
      }

      driverId = driver.id;
    }

    const { data: activeShift, error: activeShiftError } = await supabase
      .from('shifts')
      .select('id, vehicle_id')
      .eq('driver_id', driverId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeShiftError) {
      return {
        shiftId: null as string | null,
        driverId: null as string | null,
        vehicleId: null as string | null,
        error: `Unable to resolve active shift: ${activeShiftError.message}`,
      };
    }

    if (!activeShift?.id) {
      return {
        shiftId: null as string | null,
        driverId: null as string | null,
        vehicleId: null as string | null,
        error: 'No active shift found.',
      };
    }

    console.log('[FuelLog] recovered active shift', { shiftId: activeShift.id, vehicleId: activeShift.vehicle_id ?? null });
    updateAppState({
      activeShiftId: activeShift.id,
      activeShiftVehicleId: activeShift.vehicle_id ?? state.activeShiftVehicleId ?? state.vehicleId ?? null,
      driverRecordId: driverId,
      shiftStarted: true,
    });

    return {
      shiftId: activeShift.id,
      driverId,
      vehicleId: activeShift.vehicle_id ?? state.activeShiftVehicleId ?? state.vehicleId ?? null,
    };
  };

  const submitFuel = async () => {
    setAttemptedSubmit(true);
    setSubmitError(null);

    // Validate litres
    if (!litres.trim()) {
      return;
    }
    const litresNum = Number(litres);
    if (!Number.isFinite(litresNum) || litresNum <= 0) {
      return;
    }

    // Validate cost
    if (!cost.trim()) {
      return;
    }
    const costNum = Number(cost);
    if (!Number.isFinite(costNum) || costNum <= 0) {
      return;
    }

    // Validate odometer
    if (!odometerKm.trim()) {
      return;
    }
    const odometerNum = Number(odometerKm);
    if (!Number.isFinite(odometerNum) || odometerNum < 0) {
      return;
    }

    // Validate location
    if (!location.trim()) {
      return;
    }

    // Validate receipt photo
    if (!receiptUri) {
      return;
    }

    // Validate GPS
    const capturedGps = gps.status === 'ready' ? gps : await captureGps();
    if (!capturedGps) {
      return;
    }

    setIsSubmitting(true);
    try {
      const capturedAt = capturedGps.capturedAt;

      // Get auth user ID for photo upload path
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        setSubmitError('User not available. Please sign in again.');
        Alert.alert('Submission failed', 'User not available.');
        return;
      }
      const authUserId = authData.user.id;

      const { shiftId, driverId, vehicleId, error: shiftResolveError } = await resolveActiveShiftForFuelLog(authUserId);
      if (!shiftId) {
        const message = shiftResolveError ?? 'No active shift. Start a shift before logging fuel.';
        setSubmitError(message);
        Alert.alert('Submission failed', message);
        return;
      }

      // Upload receipt photo to Supabase Storage
      console.log('[FuelReceipt] uploading to fuel_receipts', {
        bucket: 'fuel_receipts',
        shiftId,
        userId: authUserId,
      });
      const { path: receiptPhotoPath, error: uploadError } = await uploadFuelReceipt(
        shiftId,
        receiptUri,
        authUserId
      );

      if (uploadError || !receiptPhotoPath) {
        console.error('[FuelReceipt] upload failed', { message: uploadError ?? 'no path returned' });
        setSubmitError(uploadError ?? 'Failed to upload receipt photo.');
        Alert.alert('Upload failed', uploadError ?? 'Failed to upload receipt photo.');
        return;
      }

      console.log('[FuelReceipt] upload success path', { receiptPhotoPath });

      const fuelMetadata = {
        litres: litresNum,
        cost: costNum,
        odometer_km: odometerNum,
        location_name: location,
        receipt_photo_path: receiptPhotoPath,
        accuracy: capturedGps.accuracy,
        captured_at: capturedAt,
        driver_id: driverId,
        vehicle_id: vehicleId,
        shift_id: shiftId,
      };

      console.log('[FuelLog] metadata before createEvent', fuelMetadata);

      const result = await createEvent(
        'fuel_log',
        fuelMetadata,
        {
          locationOverride: {
            latitude: capturedGps.latitude,
            longitude: capturedGps.longitude,
          },
        }
      );

      if (result.status === 'error') {
        setSubmitError(result.error ?? 'Could not save fuel log.');
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
      {attemptedSubmit && !litres.trim() && (
        <Text style={styles.errorText}>Litres is required.</Text>
      )}
      {attemptedSubmit && litres.trim() && !Number.isFinite(Number(litres)) && (
        <Text style={styles.errorText}>Litres must be a valid number.</Text>
      )}
      {attemptedSubmit && litres.trim() && Number.isFinite(Number(litres)) && Number(litres) <= 0 && (
        <Text style={styles.errorText}>Litres must be greater than 0.</Text>
      )}

      {attemptedSubmit && !cost.trim() && (
        <Text style={styles.errorText}>Cost is required.</Text>
      )}
      {attemptedSubmit && cost.trim() && !Number.isFinite(Number(cost)) && (
        <Text style={styles.errorText}>Cost must be a valid number.</Text>
      )}
      {attemptedSubmit && cost.trim() && Number.isFinite(Number(cost)) && Number(cost) <= 0 && (
        <Text style={styles.errorText}>Cost must be greater than 0.</Text>
      )}

      {attemptedSubmit && !odometerKm.trim() && (
        <Text style={styles.errorText}>Odometer (km) is required.</Text>
      )}
      {attemptedSubmit && odometerKm.trim() && !Number.isFinite(Number(odometerKm)) && (
        <Text style={styles.errorText}>Odometer must be a valid number.</Text>
      )}
      {attemptedSubmit && odometerKm.trim() && Number.isFinite(Number(odometerKm)) && Number(odometerKm) < 0 && (
        <Text style={styles.errorText}>Odometer cannot be negative.</Text>
      )}

      {attemptedSubmit && !location.trim() && (
        <Text style={styles.errorText}>Location (fuel station) is required.</Text>
      )}

      {attemptedSubmit && !receiptUri && (
        <Text style={styles.errorText}>Receipt photo is required.</Text>
      )}
      {submitError ? (
        <Text style={styles.errorText}>{submitError}</Text>
      ) : null}

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
