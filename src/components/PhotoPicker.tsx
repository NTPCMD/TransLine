import React, { useRef, useState } from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { getGpsFix } from '../lib/locationEvents';

interface PhotoPickerProps {
  uri?: string | null;
  onChange: (uri: string | null) => void;
  label?: string;
  cameraOnly?: boolean;
  onCaptureMeta?: (meta: {
    capturedAt: string;
    location: { lat: number | null; lng: number | null; accuracy: number | null };
    locationDenied?: boolean;
  }) => void;
}

export default function PhotoPicker({ uri, onChange, label, cameraOnly = false, onCaptureMeta }: PhotoPickerProps) {
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const pickImage = async (fromCamera = false) => {
    try {
      setLoading(true);
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          alert('Camera permission is required to take photos.');
          setLoading(false);
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          alert('Media library permission is required to choose photos.');
          setLoading(false);
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.6,
            cameraType: cameraFacing === 'back'
              ? ImagePicker.CameraType.back
              : ImagePicker.CameraType.front,
          })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

      if (!result.canceled) {
        // @ts-ignore - expo types sometimes use `uri` or `assets`
        const pickedUri = result.uri ?? (result.assets && result.assets[0]?.uri) ?? null;
        if (pickedUri) {
          if (fromCamera && onCaptureMeta) {
            const capturedAt = new Date().toISOString();
            let locationDenied = false;
            let location: { lat: number | null; lng: number | null; accuracy: number | null } = {
              lat: null,
              lng: null,
              accuracy: null,
            };
            try {
              const fix = await getGpsFix();
              location = { lat: fix.latitude, lng: fix.longitude, accuracy: fix.accuracy };
            } catch (e) {
              locationDenied = true;
            }
            onCaptureMeta({ capturedAt, location, locationDenied });
          }
          onChange(pickedUri);
        }
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Photo failed', 'Unable to capture photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openCamera = async () => {
    if (cameraPermission?.granted === false) {
      const requested = await requestCameraPermission();
      if (!requested.granted) {
        Alert.alert('Camera required', 'Camera permission is required to take photos.');
        return;
      }
    }
    if (!cameraPermission?.granted) {
      const requested = await requestCameraPermission();
      if (!requested.granted) {
        Alert.alert('Camera required', 'Camera permission is required to take photos.');
        return;
      }
    }
    setShowCamera(true);
  };

  const captureWithCamera = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    const capturedAt = new Date().toISOString();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (!photo?.uri) {
        Alert.alert('Photo failed', 'Unable to capture photo. Please try again.');
        return;
      }

      // Attach the location metadata BEFORE handing back the photo, so it is always
      // present when the driver submits (no "metadata is missing" race). getGpsFix
      // is fast now — it uses a recent cached fix and times out instead of hanging.
      if (onCaptureMeta) {
        let locationDenied = false;
        let location: { lat: number | null; lng: number | null; accuracy: number | null } = {
          lat: null,
          lng: null,
          accuracy: null,
        };
        try {
          const fix = await getGpsFix();
          location = { lat: fix.latitude, lng: fix.longitude, accuracy: fix.accuracy };
        } catch (e) {
          locationDenied = true;
        }
        onCaptureMeta({ capturedAt, location, locationDenied });
      }

      onChange(photo.uri);
      setShowCamera(false);
    } catch (e) {
      console.warn(e);
      Alert.alert('Photo failed', 'Unable to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFlipCamera = () => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {uri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri }} style={styles.preview} />
          <View style={styles.previewActions}>
            <TouchableOpacity onPress={() => pickImage(true)} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(null)} style={[styles.smallButton, styles.removeButton]}>
              <Text style={[styles.smallButtonText, { color: '#fff' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity onPress={() => pickImage(true)} style={styles.actionButton}>
            <Text style={styles.actionText}>Take photo</Text>
          </TouchableOpacity>
          {!cameraOnly ? (
            <TouchableOpacity onPress={() => pickImage(false)} style={styles.actionButton}>
              <Text style={styles.actionText}>Choose from library</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.cameraPreview} facing={cameraFacing} />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              onPress={() => setShowCamera(false)}
              style={[styles.cameraButton, styles.cancelButton]}
              disabled={isCapturing}
            >
              <Text style={styles.cameraButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFlipCamera}
              style={[styles.cameraButton, styles.flipButton]}
              disabled={isCapturing}
            >
              <Text style={styles.cameraButtonText}>Flip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={captureWithCamera}
              style={[styles.cameraButton, styles.captureButton]}
              disabled={isCapturing}
            >
              {isCapturing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.cameraButtonText}>Capture</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    marginBottom: 6,
    color: '#374151',
    fontWeight: '600',
  },
  pickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  actionText: {
    color: '#111827',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preview: {
    width: 120,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  previewActions: {
    flexDirection: 'column',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    marginBottom: 6,
  },
  removeButton: {
    backgroundColor: '#D32F2F',
  },
  smallButtonText: {
    color: '#111827',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#111827',
  },
  cameraButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#374151',
  },
  captureButton: {
    backgroundColor: '#C62828',
  },
  flipButton: {
    backgroundColor: '#2563EB',
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
