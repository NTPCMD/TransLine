import React, { useState } from 'react';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function ReadingsAndPhotosScreen({ navigation }: ScreenProps<'ReadingsAndPhotos'>) {
  const { updateAppState } = useAppState();
  const [reading, setReading] = useState('');
  const [photoNote, setPhotoNote] = useState('');

  const handleContinue = () => {
    updateAppState({
      odometerReading: reading,
      odometerPhoto: photoNote,
      shiftStartTime: new Date(),
    });
    navigation.replace('ActiveShift');
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
      <TextField
        label="Photo note"
        value={photoNote}
        onChangeText={setPhotoNote}
        placeholder="Describe the photo you captured"
      />
      <Button label="Continue" onPress={handleContinue} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
