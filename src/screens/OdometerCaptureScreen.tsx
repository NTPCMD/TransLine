import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import Button from '../components/Button';
import ScreenContainer from '../components/ScreenContainer';
import { useAppState } from '../state/AppStateContext';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

type OdometerKind = 'start' | 'mid' | 'end';

interface OdometerCaptureScreenProps extends ScreenProps<'OdometerCapture'> {
  params?: {
    kind?: OdometerKind;
    shiftId?: string;
    onComplete?: (odometerValue: number, photoUri: string) => void;
    onCancel?: () => void;
  };
}

export default function OdometerCaptureScreen({
  navigation,
  route,
}: OdometerCaptureScreenProps) {
  const params = route?.params;
  const kind = (params?.kind ?? 'start') as OdometerKind;
  const shiftId = params?.shiftId;
  const onComplete = params?.onComplete;
  const onCancel = params?.onCancel;

  const { state } = useAppState();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [odometerValue, setOdometerValue] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Get current location for odometer capture
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          if (newStatus !== 'granted') {
            console.warn('[Odometer] Location permission not granted');
            return;
          }
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
        console.log('[Odometer] Got location:', currentLocation.coords);
      } catch (e) {
        console.error('[Odometer] Failed to get location:', e);
      }
    };

    getCurrentLocation();
  }, []);

  // Request camera permission
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        exif: false,
      });
      if (photo) {
        setPhotoUri(photo.uri);
        console.log('[Odometer] Photo captured:', photo.uri);
      }
    } catch (error) {
      Alert.alert('Capture Error', 'Failed to capture photo. Please try again.');
      console.error('[Odometer] Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFlipCamera = () => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const handleSave = async () => {
    // Validate odometer value
    const value = Number(odometerValue);
    if (!Number.isInteger(value) || value < 0) {
      Alert.alert('Invalid Input', 'Odometer reading must be a whole number >= 0');
      return;
    }

    if (!photoUri) {
      Alert.alert('Missing Photo', 'Please capture an odometer photo');
      return;
    }

    if (!location) {
      Alert.alert('Missing Location', 'Unable to capture location. Please try again.');
      return;
    }

    setIsSaving(true);

    try {
      const effectiveShiftId = shiftId || state.activeShiftId;
      if (!effectiveShiftId) {
        Alert.alert('Error', 'No active shift. Please start a shift first.');
        return;
      }

      if (onComplete) {
        onComplete(value, photoUri);
      } else {
        // Navigation without params - just go back
        navigation.goBack();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to save odometer: ${msg}`);
      console.error('[Odometer] Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigation.goBack();
    }
  };

  if (!permission) {
    return (
      <ScreenContainer title="Camera Permission">
        <View style={styles.centerContent}>
          <Text style={styles.permissionText}>Camera permission is required</Text>
          <Button
            label="Grant Permission"
            onPress={requestPermission}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer title="Camera Permission Denied">
        <View style={styles.centerContent}>
          <Text style={styles.permissionText}>
            Camera permission was denied. Please enable it in settings.
          </Text>
          <Button label="Back" onPress={handleCancel} variant="ghost" />
        </View>
      </ScreenContainer>
    );
  }

  const kindLabel =
    kind === 'start' ? 'Start Odometer' : kind === 'end' ? 'End Odometer' : 'Mid-Shift Odometer';

  if (photoUri) {
    return (
      <ScreenContainer title={kindLabel} subtitle="Confirm odometer reading and photo">
        <View style={styles.previewContainer}>
          <View style={styles.imageWrapper}>
            <Text style={styles.placeholderText}>[Photo Preview]</Text>
            <Text style={styles.photoUriText}>{photoUri.substring(0, 50)}...</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Odometer Reading</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 152340"
            value={odometerValue}
            onChangeText={setOdometerValue}
            keyboardType="number-pad"
            editable={!isSaving}
          />

          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Location Fix:</Text>
            <Text style={styles.locationText}>
              {location
                ? `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`
                : 'Obtaining location...'}
            </Text>
            {location && location.coords.accuracy !== null && (
              <Text style={styles.accuracyText}>Accuracy: ±{location.coords.accuracy.toFixed(0)}m</Text>
            )}
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <Button
            label={isSaving ? 'Saving...' : 'Confirm & Save'}
            onPress={handleSave}
            disabled={isSaving || !odometerValue}
          />
          <Button label="Retake Photo" onPress={handleRetake} variant="secondary" disabled={isSaving} />
          <Button label="Cancel" onPress={handleCancel} variant="ghost" disabled={isSaving} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title={kindLabel} subtitle="Capture odometer reading with camera">
      <View style={[styles.cameraContainer, { height: screenHeight * 0.5 }]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraFacing}
        />

        {isCapturing && (
          <View style={styles.capturingOverlay}>
            <ActivityIndicator size="large" color="#FFF" />
          </View>
        )}
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Position the odometer clearly in the center of the frame. Ensure good lighting.
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={handleFlipCamera}
          disabled={isCapturing}
        >
          <Text style={styles.flipButtonText}>Flip Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.captureButton, isCapturing && styles.capturingButton]}
          onPress={handleCapture}
          disabled={isCapturing}
        >
          <View style={styles.captureDot} />
        </TouchableOpacity>
      </View>

      <Button label="Cancel" onPress={handleCancel} variant="ghost" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  cameraContainer: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  capturingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructions: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 8,
    marginBottom: 16,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  flipButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  flipButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  capturingButton: {
    opacity: 0.6,
  },
  captureDot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  previewContainer: {
    marginBottom: 16,
  },
  imageWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  photoUriText: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  form: {
    gap: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  locationInfo: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#111827',
    fontFamily: 'monospace',
  },
  accuracyText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});
