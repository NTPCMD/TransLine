import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

const severityOptions = ['Low', 'Medium', 'High'] as const;
const titleOptions = ['Incidents', 'Maintenance', 'Accidents', 'General'] as const;

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
  const [severity, setSeverity] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gps, setGps] = useState<GpsCaptureState>({ status: 'idle' });
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

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

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    if (!severity || !title || !details) {
      Alert.alert('Missing details', 'Please provide severity, title, and description.');
      return;
    }

    const capturedGps = gps.status === 'ready' ? gps : await captureGps();
    if (!capturedGps) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEvent(
        'incident',
        {
          severity,
          title,
          description: details,
          photo_urls: photoUri ? [photoUri] : [],
          accuracy: capturedGps.accuracy,
          captured_at: capturedGps.capturedAt,
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
        Alert.alert('Submission failed', result.error ?? 'Could not submit incident report.');
        return;
      }

      Alert.alert(
        result.status === 'queued' ? 'Queued for sync' : 'Incident submitted',
        result.status === 'queued'
          ? 'No connection — incident report will sync when you are back online.'
          : 'The operations team has been notified.',
      );
      navigation.goBack();
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
      <View style={styles.titleContainer}>
        <Text style={styles.severityLabel}>Title</Text>
        <View style={styles.titleRow}>
          {titleOptions.map(option => (
            <Button
              key={option}
              label={option}
              variant={title === option ? 'primary' : 'secondary'}
              onPress={() => setTitle(option)}
              style={styles.titleButton}
            />
          ))}
        </View>
      </View>
      <TextField
        label="Description"
        value={details}
        onChangeText={setDetails}
        placeholder="Describe what happened"
        multiline
      />
      <PhotoPicker label="Photo (optional)" uri={photoUri} onChange={setPhotoUri} />

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

      <Button label={isSubmitting ? 'Submitting…' : 'Submit report'} onPress={handleSubmit} disabled={isSubmitting} />
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
    gap: 8,
  },
  severityButton: {
    flex: 1,
  },
  titleContainer: {
    width: '100%',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  titleButton: {
    width: '48%',
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
