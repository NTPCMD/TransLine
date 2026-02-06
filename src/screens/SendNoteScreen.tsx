import React, { useState } from 'react';
import { Alert } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function SendNoteScreen(props: ScreenProps<'SendNote'>) {
  const { navigation } = props;
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createEvent, state, updateAppState } = useAppState();

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isSubmitting) {
        return;
      }
      event.preventDefault();
    });

    return unsubscribe;
  }, [isSubmitting, navigation]);

  const handleSend = async () => {
    if (isSubmitting) return;
    if (!note) {
      Alert.alert('Add a note', 'Please enter a short message.');
      return;
    }
    setIsSubmitting(true);
    let shouldReset = true;
    try {
      const trimmedNote = note.trim();
      updateAppState({ shiftNotes: [...state.shiftNotes, trimmedNote] });
      const result = await createEvent('note', { note_text: trimmedNote });
      if (result.status === 'error') {
        Alert.alert('Unable to send note', result.error ?? 'Please try again.');
        return;
      }
      Alert.alert('Note sent', 'Operations have received your note.');
      shouldReset = false;
      navigation.goBack();
    } catch (error) {
      Alert.alert('Unable to send note', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (shouldReset) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <ScreenContainer title="Send note" subtitle="Message the operations team">
      <TextField label="Message" value={note} onChangeText={setNote} placeholder="Type your message" multiline />
      <Button label={isSubmitting ? 'Sending...' : 'Send'} onPress={handleSend} disabled={isSubmitting} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} disabled={isSubmitting} />
    </ScreenContainer>
  );
}
