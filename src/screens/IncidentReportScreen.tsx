import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import { useActiveShift } from '../state/ActiveShiftContext';
import { uploadDriverLogPhoto } from '../lib/photoUpload';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

const severityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
] as const;

const categoryOptions = [
  { label: 'Incident', value: 'incident' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Accident', value: 'accident' },
  { label: 'General', value: 'general' },
] as const;

type GpsCaptureState =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'ready'; latitude: number; longitude: number; accuracy: number | null; capturedAt: string }
  | { status: 'denied' }
  | { status: 'failed'; message: string };

type ReadyGps = Extract<GpsCaptureState, { status: 'ready' }>;

export default function IncidentReportScreen(props: ScreenProps<'IncidentReport'>) {
  const { navigation } = props;
  const { createEvent, state } = useAppState();
  const { shift: activeShift, reload: reloadActiveShift } = useActiveShift();
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | ''>('');
  const [category, setCategory] = useState<'incident' | 'maintenance' | 'accident' | 'general' | ''>('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gps, setGps] = useState<GpsCaptureState>({ status: 'idle' });
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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
      setGps({ status: 'failed', message: err?.message ?? 'GPS fix failed. Please try again.' });
      return null;
    }
  }, []);

  useEffect(() => {
    void captureGps();
  }, [captureGps]);

  useEffect(() => {
    if (activeShift?.id) {
      console.log('[DriverLog] activeShift resolved', { shiftId: activeShift.id });
      return;
    }

    console.log('[DriverLog] activeShift missing');
  }, [activeShift?.id]);

  const handleSubmit = async () => {
    console.log('[DriverLog] submit pressed');
    setAttemptedSubmit(true);
    setSubmitError(null);

    if (!category) {
      setSubmitError('Category is required.');
      Alert.alert('Missing details', 'Please select a category.');
      return;
    }

    if (!severity) {
      setSubmitError('Severity is required.');
      Alert.alert('Missing details', 'Please select severity.');
      return;
    }

    if (!details.trim()) {
      setSubmitError('Description is required.');
      Alert.alert('Missing details', 'Please provide a description.');
      return;
    }

    if (!activeShift?.id) {
      console.log('[DriverLog] activeShift missing');
      setSubmitError('No active shift. Start a shift before submitting a driver log.');
      Alert.alert('Missing details', 'No active shift. Start a shift before submitting a driver log.');
      return;
    }

    const capturedGps = gps.status === 'ready' ? gps : await captureGps();
    if (!capturedGps) {
      setSubmitError('GPS location is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      let photoPath: string | null = null;
      if (photoUri) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user?.id) {
          setSubmitError('User not available. Please sign in again.');
          Alert.alert('Submission failed', 'User not available.');
          return;
        }

        const { path, error: uploadError } = await uploadDriverLogPhoto(
          activeShift.id,
          photoUri,
          authData.user.id
        );

        if (uploadError || !path) {
          const message = uploadError ?? 'Failed to upload photo.';
          setSubmitError(message);
          Alert.alert('Upload failed', message);
          return;
        }
        photoPath = path;
      }

      console.log('[DriverLog] submitting with shiftId', { shiftId: activeShift.id });
      const result = await createEvent(
        'driver_log',
        {
          category,
          severity,
          title: title.trim() || category,
          description: details.trim(),
          photo_path: photoPath,
          captured_at: capturedGps.capturedAt,
          driver_id: state.driverRecordId ?? null,
          vehicle_id: activeShift.vehicle_id ?? state.activeShiftVehicleId ?? state.vehicleId ?? null,
          shift_id: activeShift.id,
        },
        {
          queueOnError: true,
          locationOverride: {
            latitude: capturedGps.latitude,
            longitude: capturedGps.longitude,
          },
        },
        activeShift.id
      );

      if (result.status === 'error') {
        const message = result.error ?? 'Could not submit incident report.';
        console.error('[DriverLog] insert failed', {
          status: result.status,
          error: result.error ?? null,
          shiftId: activeShift.id,
        });
        setSubmitError(message);
        Alert.alert('Submission failed', message);
        return;
      }

      console.log('[DriverLog] insert success', { shiftId: activeShift.id, queued: result.status === 'queued' });

      Alert.alert(
        result.status === 'queued' ? 'Saved offline' : 'Incident submitted',
        result.status === 'queued'
          ? 'Saved offline. Will sync automatically.'
          : 'The operations team has been notified.'
      );
      await reloadActiveShift();
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit incident report.';
      console.error('[DriverLog] insert failed', {
        status: 'exception',
        error: message,
        shiftId: activeShift?.id ?? null,
      });
      setSubmitError(message);
      Alert.alert('Submission failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const gpsLabel = () => {
    switch (gps.status) {
      case 'idle':
        return null;
      case 'fetching':
        return { text: 'Getting location…', color: '#1D4ED8' };
      case 'ready':
        return {
          text: `📍 ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}${gps.accuracy !== null ? ` (±${Math.round(gps.accuracy)}m)` : ''}`,
          color: '#166534',
        };
      case 'denied':
        return {
          text: 'Location permission denied. Please enable in device settings and retry.',
          color: '#B91C1C',
        };
      case 'failed':
        return { text: `GPS failed: ${gps.message}`, color: '#B91C1C' };
    }
  };

  const label = gpsLabel();

  const renderCategoryButton = (option: (typeof categoryOptions)[number]) => {
    const selected = category === option.value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        onPress={() => setCategory(option.value)}
        style={[styles.categoryButton, selected ? styles.categoryButtonActive : styles.categoryButtonInactive]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit={false}
          style={[styles.choiceLabel, selected ? styles.choiceLabelActive : styles.choiceLabelInactive]}
        >
          {option.label}
        </Text>
      </Pressable>
    );
  };

  const renderSeverityButton = (option: (typeof severityOptions)[number]) => {
    const selected = severity === option.value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        onPress={() => setSeverity(option.value)}
        style={[styles.severityChoice, selected ? styles.severityChoiceActive : styles.severityChoiceInactive]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit={false}
          style={[styles.choiceLabel, selected ? styles.choiceLabelActive : styles.choiceLabelInactive]}
        >
          {option.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScreenContainer title="Incident report" subtitle="Log an incident for operations">
      <View style={styles.severityContainer}>
        <Text style={styles.severityLabel}>Category</Text>
        <View style={styles.categoryRow}>
          {categoryOptions.map(renderCategoryButton)}
        </View>
        {attemptedSubmit && !category ? <Text style={styles.errorText}>Category is required.</Text> : null}

        <Text style={[styles.severityLabel, { marginTop: 8 }]}>Severity</Text>
        <View style={styles.severityRow}>
          {severityOptions.map(renderSeverityButton)}
        </View>
        {attemptedSubmit && !severity ? <Text style={styles.errorText}>Severity is required.</Text> : null}
      </View>
      <View style={styles.titleContainer}>
        <Text style={styles.severityLabel}>Title</Text>
        <TextField
          label=""
          value={title}
          onChangeText={setTitle}
          placeholder="Optional short title"
        />
      </View>
      <TextField
        label="Description"
        value={details}
        onChangeText={setDetails}
        placeholder="Describe what happened"
        multiline
      />
      {attemptedSubmit && !details.trim() ? <Text style={styles.errorText}>Description is required.</Text> : null}
      <PhotoPicker label="Photo (optional)" uri={photoUri} onChange={setPhotoUri} cameraOnly />

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

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      {!activeShift?.id ? <Text style={styles.errorText}>No active shift. Start a shift before submitting a driver log.</Text> : null}

      <Button
        label={isSubmitting ? 'Submitting…' : 'Submit report'}
        onPress={handleSubmit}
        disabled={isSubmitting || !activeShift?.id}
      />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} disabled={isSubmitting} />
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  titleContainer: {
    width: '100%',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  categoryButton: {
    width: '48%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  categoryButtonActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  categoryButtonInactive: {
    backgroundColor: '#EDEFF2',
    borderColor: '#D1D5DB',
  },
  severityChoice: {
    width: '31.5%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  severityChoiceActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  severityChoiceInactive: {
    backgroundColor: '#EDEFF2',
    borderColor: '#D1D5DB',
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 0,
  },
  choiceLabelActive: {
    color: '#FFFFFF',
  },
  choiceLabelInactive: {
    color: '#111827',
  },
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
