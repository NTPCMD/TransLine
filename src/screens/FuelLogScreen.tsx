import React, { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

export default function FuelLogScreen({ navigation }: ScreenProps<'FuelLog'>) {
  const [litres, setLitres] = useState('');
  const [location, setLocation] = useState('');

  const submitFuel = () => {
    if (!litres || !location) {
      Alert.alert('Missing information', 'Please add fuel volume and location.');
      return;
    }
    Alert.alert('Fuel logged', 'Your fuel entry has been saved.');
    navigation.goBack();
  };

  return (
    <ScreenContainer title="Fuel log" subtitle="Record fuel stops during your shift">
      <TextField label="Litres" value={litres} onChangeText={setLitres} keyboardType="numeric" placeholder="0" />
      <TextField label="Location" value={location} onChangeText={setLocation} placeholder="Fuel station" />
      <Button label="Submit" onPress={submitFuel} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
