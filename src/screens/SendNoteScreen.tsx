import React, { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import type { ScreenProps } from '../types/navigation';

export default function SendNoteScreen({ navigation }: ScreenProps<'SendNote'>) {
  const [note, setNote] = useState('');

  const handleSend = () => {
    if (!note) {
      Alert.alert('Add a note', 'Please enter a short message.');
      return;
    }
    Alert.alert('Note sent', 'Operations have received your note.');
    navigation.goBack();
  };

  return (
    <ScreenContainer title="Send note" subtitle="Message the operations team">
      <TextField label="Message" value={note} onChangeText={setNote} placeholder="Type your message" multiline />
      <Button label="Send" onPress={handleSend} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </ScreenContainer>
  );
}
