import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer/dist/base64-arraybuffer.umd.js';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import { useActiveAssignment } from '../state/AssignmentContext';
import { getGpsFix } from '../lib/gps';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

export default function ReadingsAndPhotosScreen(props: ScreenProps<'ReadingsAndPhotos'>) {
  const { navigation } = props;
  const { state, startShift, updateAppState } = useAppState();
  const [reading, setReading] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [odometerPhotoPath, setOdometerPhotoPath] = useState<string | null>(null);
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startWarning, setStartWarning] = useState<string | null>(null);

  const { status, vehicle, refresh } = useActiveAssignment();
  const showRefreshAssignment =
    (status !== 'loading' && !vehicle) || Boolean(startError?.toLowerCase().includes('refresh assignment'));
  const vehicleId = vehicle?.id ?? null;
  const hasPhoto = Boolean(odometerPhotoPath);
  const hasReading = Boolean(reading.trim());
  const canContinue = hasReading && hasPhoto && !isUploading && !isSaving;

  React.useEffect(() => {
    console.log('assignment status', status, vehicle);
    console.log('odometer screen vehicle_id', vehicle?.id);
  }, [status, vehicle]);

  React.useEffect(() => {
    console.log('[Odometer] gate', {
      odometerReading: reading,
      odometerPhotoPath,
      startOdometerLat: state.startOdometerLat,
      startOdometerLng: state.startOdometerLng,
      isUploading,
      isSaving,
      vehicleId,
    });
  }, [
    reading,
    odometerPhotoPath,
    state.startOdometerLat,
    state.startOdometerLng,
    isUploading,
    isSaving,
    vehicleId,
  ]);

  const resolveAuthUserId = async () => {
    if (state.userId) return state.userId;
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    const uid = data?.user?.id ?? null;
    if (uid) {
      updateAppState({ userId: uid, isLoggedIn: true });
    }
    return uid;
  };

  const mimeFromExtension = (ext: string) => {
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      case 'heif':
        return 'image/heif';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  };

  const extractExtension = (uri: string, mimeType: string | null) => {
    if (uri.startsWith('data:')) {
      if (!mimeType) return 'jpg';
      return mimeType.split('/')[1] ?? 'jpg';
    }
    const trimmed = uri.split('?')[0].split('#')[0];
    const lastDot = trimmed.lastIndexOf('.');
    if (lastDot > -1 && lastDot < trimmed.length - 1) {
      return trimmed.slice(lastDot + 1).toLowerCase();
    }
    if (mimeType) {
      return mimeType.split('/')[1] ?? 'jpg';
    }
    return 'jpg';
  };

  const uploadOdometerPhoto = async (localUri: string, vehicleIdToUse: string) => {
    const authUserId = await resolveAuthUserId();
    if (!authUserId) {
      throw new Error('User not available. Please sign in again.');
    }

    let base64 = '';
    if (localUri.startsWith('data:')) {
      base64 = localUri.split(',')[1] ?? '';
    } else {
      base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    }

    if (!base64) {
      throw new Error('Unable to read odometer photo data.');
    }

    const objectPath = `${authUserId}/odometer/${vehicleIdToUse}/${Date.now()}.jpg`;
    const buffer = decodeBase64(base64);
    const { error: uploadError } = await supabase.storage.from('odometer_photos').upload(objectPath, buffer, {
      contentType: 'image/jpeg',
    });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    return { path: objectPath, authUserId };
  };

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
      const capturedAt = state.startOdometerCapturedAt ?? new Date().toISOString();
      updateAppState({
        startOdometerCapturedAt: capturedAt,
        startOdometerLat: fix.latitude,
        startOdometerLng: fix.longitude,
        startOdometerAccuracy: fix.accuracy,
        shiftStartTime: state.shiftStartTime ?? new Date(capturedAt),
      });
      return {
        capturedAt,
        lat: fix.latitude,
        lng: fix.longitude,
        accuracy: fix.accuracy,
      };
    } catch (e) {
      setStartError(
        'Location is required for the odometer photo. Please allow Location for this site/app, then try again.'
      );
      return null;
    }
  };

  const handleContinue = async () => {
    setAttemptedSubmit(true);
    setStartError(null);
    setStartWarning(null);
    console.log('start shift submit pressed', { status, vehicleId: vehicle?.id });
    if (isUploading || isSaving) {
      return;
    }
    if (!reading.trim() || !odometerPhotoPath) {
      // Inline errors will show; prevent navigation
      return;
    }

    if (!vehicle) {
      setStartError('No active vehicle assignment. Refresh assignment to continue.');
      return;
    }

    if (!state.checklistSubmitted && state.preStartChecklistAnswers.length === 0) {
      console.warn('Proceeding without checklist state set.');
    }

    const odometerValue = Number(reading);
    if (!Number.isInteger(odometerValue) || odometerValue < 0) {
      setStartError('Odometer value must be a valid whole number.');
      return;
    }

    const gps = await ensureStartOdometerGps();
    if (!gps) {
      return;
    }

    updateAppState({
      odometerReading: reading,
      odometerPhoto: photoUri ?? '',
    });

    let uploadedPath = uploadedPhotoPath;
    let authUserId = state.userId;
    if (!uploadedPath) {
      setIsUploading(true);
      try {
        const uploadResult = await uploadOdometerPhoto(odometerPhotoPath, vehicle.id);
        uploadedPath = uploadResult.path;
        authUserId = uploadResult.authUserId;
        setUploadedPhotoPath(uploadedPath);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to upload odometer photo.';
        console.error('Failed to upload odometer photo', { message, vehicleId, uri: odometerPhotoPath });
        Alert.alert('Upload failed', message, [{ text: 'OK' }]);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    setIsSaving(true);
    try {
      const driverRecordId = state.driverRecordId;
      if (!driverRecordId) {
        throw new Error('Driver profile not available.');
      }

      const capturedAt = gps.capturedAt ?? new Date().toISOString();
      const payload = {
        driver_id: driverRecordId,
        vehicle_id: vehicle.id,
        shift_id: state.activeShiftId ?? null,
        odometer_value: parseInt(reading, 10),
        photo_path: uploadedPath,
        recorded_at: capturedAt,
        lat: state.startOdometerLat ?? gps.lat ?? null,
        lng: state.startOdometerLng ?? gps.lng ?? null,
        accuracy_m: null,
      };
      const { error: insertError } = await supabase.from('odometer_logs').insert(payload);
      if (insertError) {
        console.error('Failed to insert odometer reading', { message: insertError.message, insertError });
        throw new Error(insertError.message);
      }

      const { shiftId, error, queued } = await startShift({
        odometerReading: reading,
        odometerPhoto: photoUri ?? '',
        odometerPhotoPath: uploadedPath ?? undefined,
        capturedAt,
        location: { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy },
      });
      console.log('start shift response', { shiftId, error, queued });
      if (!shiftId) {
        throw new Error(error ?? 'Unable to start shift.');
      }
      if (queued) {
        setStartWarning('Odometer captured offline. It will sync when you are online.');
      }
      updateAppState({ shiftStarted: true });
      // After readings, navigate to main drawer home (dashboard)
      navigation.replace('Main');
      console.log('navigation to Main after start shift');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save odometer reading.';
      console.error('Failed to save odometer reading', { message, vehicleId, uploadedPath });
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
        placeholder="Enter the odometer"
      />

      <PhotoPicker
        label="Odometer photo (required)"
        uri={photoUri}
        onChange={(uri) => {
          setPhotoUri(uri);
          setOdometerPhotoPath(uri);
          setUploadedPhotoPath(null);
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
            setStartError(
              'Location denied. Tap the address bar lock icon (or app settings) and allow Location, then try again.'
            );
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
      ) : vehicle ? (
        <Text style={{ marginTop: 8 }}>
          Vehicle: {vehicle.label ?? vehicle.registration ?? vehicle.rego ?? vehicle.plate_number ?? 'Unknown registration'}
        </Text>
      ) : (
        <Text style={{ color: '#D32F2F', marginTop: 8 }}>No active vehicle assignment. Refresh assignment.</Text>
      )}

      {showRefreshAssignment ? (
        <Button label="Refresh assignment" variant="ghost" onPress={() => refresh(true)} />
      ) : null}

      {attemptedSubmit && !reading.trim() ? (
        <Text style={{ color: '#D32F2F' }}>Odometer value is required.</Text>
      ) : null}
      {attemptedSubmit && !odometerPhotoPath ? (
        <Text style={{ color: '#D32F2F' }}>Odometer photo is required.</Text>
      ) : null}
      {isUploading ? <Text style={{ color: '#6B7280' }}>Uploading odometer photo...</Text> : null}
      {isSaving ? <Text style={{ color: '#6B7280' }}>Starting shift...</Text> : null}
      {startError ? <Text style={{ color: '#D32F2F' }}>{startError}</Text> : null}
      {startWarning ? <Text style={{ color: '#F59E0B' }}>{startWarning}</Text> : null}

      <Button
        label="Continue"
        onPress={handleContinue}
        disabled={!canContinue}
      />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
