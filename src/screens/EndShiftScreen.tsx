import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import InfoCard from '../components/InfoCard';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import Button from '../components/Button';
import TextField from '../components/TextField';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

export default function EndShiftScreen({ navigation }: ScreenProps<'EndShift'>) {
  const { closeActiveBreak, createEvent, endShift, state, resetShift, updateAppState } = useAppState();
  const [rubbishRemoved, setRubbishRemoved] = useState<'yes' | 'no' | null>(state.endShiftRubbishRemoved);
  const [endShiftNotes, setEndShiftNotes] = useState(state.endShiftNotes);
  const [endOdometerReading, setEndOdometerReading] = useState('');
  const [endOdometerPhoto, setEndOdometerPhoto] = useState<string | null>(null);
  const [endPhotoMeta, setEndPhotoMeta] = useState<{
    capturedAt: string;
    location: { lat: number; lng: number; accuracy: number | null };
  } | null>(null);
  const [startOdometerValue, setStartOdometerValue] = useState<number | null>(null);
  const [shiftLoadError, setShiftLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadShift = async () => {
      if (!state.activeShiftId) return;
      const { data, error } = await supabase
        .from('shifts')
        .select('start_odometer, end_odometer')
        .eq('id', state.activeShiftId)
        .maybeSingle();
      if (error) {
        setShiftLoadError(error.message);
        return;
      }
      setStartOdometerValue(data?.start_odometer ?? null);
      if (data?.end_odometer) {
        setShiftLoadError('End odometer already captured.');
      }
    };

    loadShift();

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isSubmitting) {
        return;
      }
      event.preventDefault();
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

  const isFormValid = () => {
    return (
      endOdometerReading.trim() !== '' &&
      Number.isInteger(Number(endOdometerReading)) &&
      endOdometerPhoto !== null &&
      endPhotoMeta !== null &&
      rubbishRemoved !== null
    );
  };

  const computeDistance = () => {
    const startValue = startOdometerValue ?? Number(state.odometerReading);
    const endValue = Number(endOdometerReading);
    if (Number.isNaN(endValue) || startValue === null || Number.isNaN(startValue)) return null;
    return endValue - startValue;
  };

  const confirmDistance = async (distanceKm: number) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        'Confirm distance',
        `Distance for this shift: ${distanceKm.toFixed(1)} km`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm', onPress: () => resolve(true) },
        ]
      );
    });

  const handleConfirm = async () => {
    if (isSubmitting) return;
    
    // Validation
    if (!endOdometerReading.trim()) {
      Alert.alert('Missing Information', 'Please enter the final odometer reading.');
      return;
    }
    const odometerValue = Number(endOdometerReading);
    if (!Number.isInteger(odometerValue)) {
      Alert.alert('Invalid Input', 'Please enter a valid whole-number odometer reading.');
      return;
    }
    if (!endOdometerPhoto) {
      Alert.alert('Missing Information', 'Please take a photo of the final odometer reading.');
      return;
    }
    if (!endPhotoMeta) {
      Alert.alert('Missing Information', 'Odometer photo metadata is missing. Please retake the photo.');
      return;
    }
    if (rubbishRemoved === null) {
      Alert.alert('Missing Information', 'Please confirm whether rubbish has been removed.');
      return;
    }
    
    if (!state.activeShiftId) {
      Alert.alert('Unable to end shift', 'No active shift found.');
      return;
    }

    if (startOdometerValue === null && !state.odometerReading) {
      Alert.alert('Unable to end shift', 'Start odometer is missing. Please capture it before ending the shift.');
      return;
    }

    const startValue = startOdometerValue ?? Number(state.odometerReading);
    if (odometerValue < startValue) {
      Alert.alert('Invalid Input', 'Final odometer must be greater than or equal to the start odometer.');
      return;
    }

    const distanceKm = odometerValue - startValue;
    const confirmed = await confirmDistance(distanceKm);
    if (!confirmed) {
      return;
    }
    
    setIsSubmitting(true);
    let shouldReset = true;
    
    try {
      if (state.isOnBreak) {
        await closeActiveBreak();
      }
      
      const shiftEndResult = await createEvent(
        'shift_end',
        { 
          end_shift_notes: endShiftNotes,
          end_odometer_value: odometerValue,
          distance_km: distanceKm,
          rubbish_removed: rubbishRemoved === 'yes'
        },
        { queueOnError: true }
      );
      
      if (shiftEndResult.status === 'error') {
        Alert.alert('Unable to end shift', shiftEndResult.error ?? 'Unable to end shift.');
        return;
      }
      
      const ended = await endShift({
        endOdometerValue: odometerValue,
        endOdometerPhoto: endOdometerPhoto,
        capturedAt: endPhotoMeta.capturedAt,
        location: endPhotoMeta.location,
      });
      if (!ended.ok) {
        Alert.alert('Unable to end shift', ended.error ?? 'Unable to end shift.');
        return;
      }
      if (ended.queued) {
        Alert.alert('Saved offline', 'End of shift details saved offline. They will sync when you are online.');
      }
      
      resetShift();
      updateAppState({ isLoggedIn: true, declarationAccepted: true });
      shouldReset = false;
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      Alert.alert('Unable to end shift', error instanceof Error ? error.message : 'Unable to end shift.');
    } finally {
      if (shouldReset) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <ScreenContainer title="End shift" subtitle="Complete your shift and log out">
      <NetworkStatusBanner />
      <InfoCard title="Summary">
        <Text style={styles.text}>Vehicle: {state.vehicleRegistration ?? state.assignedVehicle?.registration ?? 'Unknown'}</Text>
        <Text style={styles.text}>Start time: {state.shiftStartTime ? state.shiftStartTime.toLocaleTimeString() : 'Not set'}</Text>
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
            if (!uri) {
              setEndPhotoMeta(null);
            }
          }}
          cameraOnly
          onCaptureMeta={(meta) => setEndPhotoMeta(meta)}
        />
        {computeDistance() !== null && (startOdometerValue !== null || state.odometerReading) ? (
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
        disabled={isSubmitting || !isFormValid() || Boolean(shiftLoadError)} 
      />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} disabled={isSubmitting} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#111827',
    fontSize: 16,
  },
  errorText: {
    color: '#D32F2F',
    marginTop: 8,
  },
  distanceText: {
    color: '#111827',
    marginTop: 8,
    fontWeight: '600',
  },
  label: {
    color: '#2E2E2E',
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  choiceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  choiceActive: {
    backgroundColor: '#C62828',
  },
  choiceInactive: {
    backgroundColor: '#F2F2F2',
  },
  choiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  choiceTextInactive: {
    color: '#9E9E9E',
  },
});
