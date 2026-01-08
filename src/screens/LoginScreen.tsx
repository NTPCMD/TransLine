import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import { supabase } from '../lib/supabase';
import type { ScreenProps } from '../types/navigation';

export default function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { updateAppState } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (mode: 'signin' | 'signup') => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please provide both an email and password.');
      return;
    }

    const trimmedEmail = email.trim();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          Alert.alert('Sign in failed', error.message);
          return;
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) {
          Alert.alert('Sign up failed', error.message);
          return;
        }
      }

      updateAppState({ isLoggedIn: true });
      navigation.replace('DriverDeclaration');
    } catch (error) {
      Alert.alert('Authentication error', error instanceof Error ? error.message : 'Unable to authenticate.');
    }
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
      <Button label="Sign In" onPress={() => handleAuth('signin')} />
      <Button label="Create account" variant="ghost" onPress={() => handleAuth('signup')} />
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
