import React, { useState } from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface PhotoPickerProps {
  uri?: string | null;
  onChange: (uri: string | null) => void;
  label?: string;
}

export default function PhotoPicker({ uri, onChange, label }: PhotoPickerProps) {
  const [loading, setLoading] = useState(false);

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
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

      if (!result.cancelled) {
        // @ts-ignore - expo types sometimes use `uri` or `assets`
        const pickedUri = result.uri ?? (result.assets && result.assets[0]?.uri) ?? null;
        if (pickedUri) onChange(pickedUri);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
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
          <TouchableOpacity onPress={() => pickImage(false)} style={styles.actionButton}>
            <Text style={styles.actionText}>Choose from library</Text>
          </TouchableOpacity>
        </View>
      )}
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
});
