import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { updateAppState } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please provide both an email and password.');
      return;
    }
    updateAppState({ isLoggedIn: true });
    navigation.replace('DriverDeclaration');
  };

  return (
    <ScreenContainer title="Driver Login" subtitle="Sign in to start your shift">
      <TextField label="Email or phone" value={email} onChangeText={setEmail} placeholder="Enter your email or phone" />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry
      />
      <Button label="Sign In" onPress={handleLogin} />
      <Text style={styles.helpText}>Use your company credentials to access the app.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  helpText: {
    color: '#6B7280',
    marginTop: 4,
  },
});
