import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import PhotoPicker from '../components/PhotoPicker';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function FuelLogScreen(props: ScreenProps<'FuelLog'>) {
  const { navigation } = props;
  const { createEvent, updateAppState } = useAppState();
  const [litres, setLitres] = useState('');
  const [cost, setCost] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [location, setLocation] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const submitFuel = async () => {
    setAttemptedSubmit(true);
    if (!litres || !cost || !odometerKm || !location || !receiptUri) {
      return;
    }

    // Update last fuelled timestamp in global state
    updateAppState({ lastFueled: new Date().toISOString() });
    await createEvent('fuel_log', {
      litres: Number(litres),
      cost: Number(cost),
      odometer_km: Number(odometerKm),
      receipt_urls: [receiptUri],
      location_name: location,
    });

    Alert.alert('Fuel logged', 'Your fuel entry has been saved.');
    navigation.goBack();
  };

  return (
    <ScreenContainer title="Fuel log" subtitle="Record fuel stops during your shift">
      <TextField label="Litres" value={litres} onChangeText={setLitres} keyboardType="numeric" placeholder="0" />
      <TextField label="Cost" value={cost} onChangeText={setCost} keyboardType="numeric" placeholder="$0.00" />
      <TextField
        label="Odometer (km)"
        value={odometerKm}
        onChangeText={setOdometerKm}
        keyboardType="numeric"
        placeholder="0"
      />
      <TextField label="Location" value={location} onChangeText={setLocation} placeholder="Fuel station" />

      <PhotoPicker label="Receipt photo (required)" uri={receiptUri} onChange={setReceiptUri} />
      {attemptedSubmit && !receiptUri ? (
        <Text style={{ color: '#D32F2F' }}>Receipt photo is required.</Text>
      ) : null}

      <Button label="Submit" onPress={submitFuel} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
