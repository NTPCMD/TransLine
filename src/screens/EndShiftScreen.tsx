import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import Button from '../components/Button';
import TextField from '../components/TextField';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import { useDriver } from '../state/DriverContext';
import { useActiveShift } from '../state/ActiveShiftContext';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

export default function EndShiftScreen(props: ScreenProps<'EndShift'>) {
  const { navigation } = props;
  const { closeActiveBreak, endShift, state, updateAppState } = useAppState();
  const { reload: reloadDriverContext } = useDriver();
  const { reload: reloadActiveShift } = useActiveShift();
  const [rubbishRemoved, setRubbishRemoved] = useState<'yes' | 'no' | null>(state.endShiftRubbishRemoved);
  const [endShiftNotes, setEndShiftNotes] = useState(state.endShiftNotes);
  const [endOdometerReading, setEndOdometerReading] = useState('');
  const [endOdometerPhoto, setEndOdometerPhoto] = useState<string | null>(null);
  const [endPhotoMeta, setEndPhotoMeta] = useState<{
    capturedAt: string;
    location: { lat: number | null; lng: number | null; accuracy: number | null };
    locationDenied?: boolean;
  } | null>(null);
  const [startOdometerValue, setStartOdometerValue] = useState<number | null>(null);
  const [shiftLoadError, setShiftLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadShift = async () => {
      if (!state.activeShiftId) return;
      const { data, error } = await supabase
        .from('shift_events')
        .select('event_type, created_at, metadata')
        .eq('shift_id', state.activeShiftId)
        .in('event_type', ['shift_start', 'shift_end'])
        .order('created_at', { ascending: false });
      if (error) {
        setShiftLoadError(error.message);
        return;
      }

      const events = data ?? [];
      const hasShiftEnd = events.some((event) => event.event_type === 'shift_end');
      if (hasShiftEnd) {
        setShiftLoadError('End odometer already captured.');
      }

      const shiftStartEvent = events.find((event) => event.event_type === 'shift_start');
      const metadata = shiftStartEvent?.metadata && typeof shiftStartEvent.metadata === 'object'
        ? (shiftStartEvent.metadata as Record<string, unknown>)
        : null;
      const odometerRaw = metadata?.odometer_value;
      const odometerValue =
        typeof odometerRaw === 'number'
          ? odometerRaw
          : typeof odometerRaw === 'string'
            ? Number(odometerRaw)
            : null;

      setStartOdometerValue(Number.isFinite(odometerValue as number) ? (odometerValue as number) : null);
    };
    loadShift();

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isSubmitting) event.preventDefault();
    });
    return unsubscribe;
  }, [isSubmitting, navigation, state.activeShiftId]);

  const handleRubbishChange = (value: 'yes' | 'no') => {
    setRubbishRemoved(value);
    updateAppState({ endShiftRubbishRemoved: value });
  };

  const handleNotesChange = (value: string) => {
    setEndShiftNotes(value);
    updateAppState({ endShiftNotes: value });
  };

  const computeDistance = () => {
    const startValue = startOdometerValue ?? Number(state.odometerReading);
    const endValue = Number(endOdometerReading);
    if (Number.isNaN(endValue) || Number.isNaN(startValue)) return null;
    return endValue - startValue;
  };

  const handleConfirm = async () => {
    console.log('[EndShift] button pressed');
    if (isSubmitting) return;

    setSubmitError(null);
    console.log('[EndShift] validating');

    if (shiftLoadError) {
      const message = `Shift load error: ${shiftLoadError}`;
      console.warn('[EndShift] validation failed', { reason: message });
      setSubmitError(message);
      Alert.alert('Unable to end shift', message);
      return;
    }

    if (!endOdometerReading.trim()) {
      const message = 'Please enter the final odometer reading.';
      console.warn('[EndShift] validation failed', { reason: message });
      setSubmitError(message);
      Alert.alert('Missing Information', 'Please enter the final odometer reading.');
      return;
    }
    const odometerValue = Number(endOdometerReading);
    console.log('[EndShift] odometer value', { odometerValue });
    if (!Number.isInteger(odometerValue)) {
      const message = 'Please enter a valid whole-number odometer reading.';
      console.warn('[EndShift] validation failed', { reason: message, odometerValue });
      setSubmitError(message);
      Alert.alert('Invalid Input', 'Please enter a valid whole-number odometer reading.');
      return;
    }
    console.log('[EndShift] photo selected', { selected: Boolean(endOdometerPhoto) });
    if (!endOdometerPhoto) {
      const message = 'Please take a photo of the final odometer reading.';
      console.warn('[EndShift] validation failed', { reason: message });
      setSubmitError(message);
      Alert.alert('Missing Information', 'Please take a photo of the final odometer reading.');
      return;
    }
    if (!endPhotoMeta) {
      const message = 'Odometer photo metadata is missing. Please retake the photo.';
      console.warn('[EndShift] validation failed', { reason: message });
      setSubmitError(message);
      Alert.alert('Missing Information', 'Odometer photo metadata is missing. Please retake the photo.');
      return;
    }
    const endLocation = endPhotoMeta.location;
    if (endPhotoMeta.locationDenied || endLocation.lat === null || endLocation.lng === null) {
      const message = 'Location is required for the final odometer photo. Please allow Location and try again.';
      console.warn('[EndShift] validation failed', { reason: message, location: endLocation, locationDenied: endPhotoMeta.locationDenied });
      setSubmitError(message);
      Alert.alert('Location required', 'Location is required for the final odometer photo. Please allow Location and try again.');
      return;
    }
    if (rubbishRemoved === null) {
      const message = 'Please confirm whether rubbish has been removed.';
      console.warn('[EndShift] validation failed', { reason: message });
      setSubmitError(message);
      Alert.alert('Missing Information', 'Please confirm whether rubbish has been removed.');
      return;
    }

    const startValue = startOdometerValue ?? Number(state.odometerReading);
    if (odometerValue < startValue) {
      const message = 'Final odometer must be greater than or equal to the start odometer.';
      console.warn('[EndShift] validation failed', { reason: message, startValue, odometerValue });
      setSubmitError(message);
      Alert.alert('Invalid Input', 'Final odometer must be greater than or equal to the start odometer.');
      return;
    }

    const distanceKm = odometerValue - startValue;
    console.log('[EndShift] validation passed');

    setIsSubmitting(true);
    let navigationRequested = false;

    try {
      if (state.isOnBreak) {
        await closeActiveBreak();
      }

      console.log('[EndShift] calling endShift');
      const ended = await endShift({
        endOdometerValue: odometerValue,
        endOdometerPhoto: endOdometerPhoto,
        capturedAt: endPhotoMeta.capturedAt,
        location: {
          lat: endLocation.lat,
          lng: endLocation.lng,
          accuracy: endLocation.accuracy,
        },
      });

      console.log('[EndShift] endShift result', ended);

      if (!ended.ok) {
        const message = ended.error ?? 'Unable to end shift.';
        setSubmitError(message);
        Alert.alert('Unable to end shift', message);
        return;
      }

      if (ended.queued) {
        Alert.alert('Saved offline', 'End of shift details saved offline. They will sync when you are online.');
      }

      updateAppState({ isLoggedIn: true, declarationAccepted: true });

      // Must set isSubmitting false BEFORE navigation — the beforeRemove listener
      // blocks navigation while isSubmitting is true.
      setIsSubmitting(false);
      navigationRequested = true;
      console.log('[EndShift] reset navigation to dashboard');
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      console.log('[EndShift] navigation complete');
      void reloadActiveShift();
      void reloadDriverContext();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to end shift.';
      console.error('[EndShift] unexpected error', error);
      setSubmitError(message);
      Alert.alert('Unable to end shift', message);
    } finally {
      if (!navigationRequested) {
        setIsSubmitting(false);
      }
    }
  };

  const vehicleLabel = state.vehicleRegistration
    ?? state.assignedVehicle?.rego
    ?? 'Unknown';

  const shiftStartLabel = state.shiftStartTime
    ? new Date(state.shiftStartTime).toLocaleTimeString()
    : 'Not set';

  return (
    <ScreenContainer title="End shift" subtitle="Complete your shift and log out">
      <NetworkStatusBanner />
      <InfoCard title="Summary">
        <Text style={styles.text}>Vehicle: {vehicleLabel}</Text>
        <Text style={styles.text}>Start time: {shiftStartLabel}</Text>
        <Text style={styles.text}>Start Odometer: {state.odometerReading || 'Pending'}</Text>
        {shiftLoadError ? <Text style={styles.errorText}>{shiftLoadError}</Text> : null}
      </InfoCard>

      <InfoCard title="Final Odometer Reading">
        <TextField
          label="Final odometer reading"
          value={endOdometerReading}
          onChangeText={setEndOdometerReading}
          keyboardType="numeric"
          placeholder="Enter the final odometer reading"
        />
        <PhotoPicker
          label="Final odometer photo (required)"
          uri={endOdometerPhoto}
          onChange={(uri) => {
            setEndOdometerPhoto(uri);
            if (!uri) setEndPhotoMeta(null);
          }}
          cameraOnly
          onCaptureMeta={(meta) => setEndPhotoMeta(meta)}
        />
        {computeDistance() !== null ? (
          <Text style={styles.distanceText}>Distance: {computeDistance()?.toFixed(1)} km</Text>
        ) : null}
      </InfoCard>

      <InfoCard title="End of shift checklist">
        <Text style={styles.label}>Have you removed all rubbish from the vehicle?</Text>
        <View style={styles.choiceRow}>
          <Pressable
            onPress={() => handleRubbishChange('yes')}
            style={[styles.choiceButton, rubbishRemoved === 'yes' ? styles.choiceActive : styles.choiceInactive]}
          >
            <Text style={rubbishRemoved === 'yes' ? styles.choiceTextActive : styles.choiceTextInactive}>Yes</Text>
          </Pressable>
          <Pressable
            onPress={() => handleRubbishChange('no')}
            style={[styles.choiceButton, rubbishRemoved === 'no' ? styles.choiceActive : styles.choiceInactive]}
          >
            <Text style={rubbishRemoved === 'no' ? styles.choiceTextActive : styles.choiceTextInactive}>No</Text>
          </Pressable>
        </View>
        <TextField
          label="End of shift notes (optional)"
          value={endShiftNotes}
          onChangeText={handleNotesChange}
          placeholder="Add any notes about your shift..."
          multiline
        />
      </InfoCard>

      <Button
        label={isSubmitting ? 'Ending...' : 'Confirm end'}
        onPress={handleConfirm}
        disabled={isSubmitting}
      />
      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} disabled={isSubmitting} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  text: { color: '#111827', fontSize: 16 },
  errorText: { color: '#D32F2F', marginTop: 8 },
  distanceText: { color: '#111827', marginTop: 8, fontWeight: '600' },
  label: { color: '#2E2E2E', marginBottom: 8 },
  choiceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  choiceButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  choiceActive: { backgroundColor: '#C62828' },
  choiceInactive: { backgroundColor: '#F2F2F2' },
  choiceTextActive: { color: '#FFFFFF', fontWeight: '600' },
  choiceTextInactive: { color: '#9E9E9E' },
});
