import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import Button from '../components/Button';
import { useAppState } from '../state/AppStateContext';
import { fetchDriverContext } from '../lib/driverSession';
import { getAssignedVehicleForDriver } from '../lib/assignment';
import { supabase } from '../lib/supabase';
import { pushNotificationManager } from '../lib/pushNotifications';
import type { ScreenProps } from '../types/navigation';

export default function LoginScreen(props: ScreenProps<'Login'>) {
  const { navigation } = props;
  const { updateAppState } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please provide both an email and password.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    setIsSigningIn(true);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      console.log('[Login] signInWithPassword response', {
        hasSession: Boolean(signInData?.session),
        authUserId: signInData?.user?.id ?? signInData?.session?.user?.id ?? null,
        error: signInError?.message ?? null,
      });

      if (signInError) {
        Alert.alert('Sign in failed', signInError.message);
        return;
      }

      console.log('[Login] auth success', {
        authUserId: signInData?.user?.id ?? signInData?.session?.user?.id ?? null,
      });

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('[Login] getSession response', {
        authUserId: sessionData?.session?.user?.id ?? null,
        hasSession: Boolean(sessionData?.session),
        error: sessionError?.message ?? null,
      });

      const userId =
        signInData?.user?.id ??
        signInData?.session?.user?.id ??
        sessionData?.session?.user?.id ??
        null;

      console.log('[Login] resolved auth user id', { authUserId: userId });

      if (!userId) {
        console.error('[Login] auth succeeded but user id could not be resolved; routing via splash for recovery');
        Alert.alert('Authentication error', 'Unable to resolve your user session.');
        navigation.replace('Splash');
        return;
      }

      const driverContext = await fetchDriverContext(userId);
      console.log('[Login] driver context resolved', {
        authUserId: userId,
        driverId: driverContext.driver?.id ?? null,
        profileId: driverContext.profile?.id ?? null,
        error: driverContext.error ?? null,
      });

      if (!driverContext.driver) {
        await supabase.auth.signOut();
        Alert.alert(
          'Driver access not ready',
          driverContext.error ?? 'No driver profile is linked to this account yet. Please contact admin.'
        );
        return;
      }

      const driverId = driverContext.driver.id;

      const assignmentResult = await getAssignedVehicleForDriver(driverId);
      console.log('[Login] assignment lookup result', {
        authUserId: userId,
        driverId,
        assignmentFound: Boolean(assignmentResult.assignment),
        vehicleId: assignmentResult.vehicle?.id ?? null,
        error: assignmentResult.error ?? null,
      });

      const { data: activeShiftData, error: activeShiftError } = await supabase
        .from('shifts')
        .select('id, started_at, ended_at')
        .eq('driver_id', driverId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[Login] active shift lookup result', {
        authUserId: userId,
        driverId,
        activeShiftId: activeShiftData?.id ?? null,
        error: activeShiftError?.message ?? null,
      });

      updateAppState({
        isLoggedIn: true,
        userId,
        driverRecordId: driverId,
        vehicleId: assignmentResult.vehicle?.id ?? null,
        vehicleRegistration:
          assignmentResult.vehicle?.registration ??
          assignmentResult.vehicle?.rego ??
          assignmentResult.vehicle?.plate_number ??
          null,
        activeShiftId: activeShiftData?.id ?? null,
        shiftStarted: Boolean(activeShiftData?.id),
        shiftStartTime: activeShiftData?.started_at ? new Date(activeShiftData.started_at) : null,
      });

      pushNotificationManager.registerForPushNotifications().catch((error) => {
        console.error('Failed to register push notifications:', error);
      });

      if (activeShiftData?.id) {
        console.log('[LoginRoute] auth success -> active shift route', {
          activeShiftId: activeShiftData.id,
        });
        navigation.replace('ActiveShift');
        return;
      }

      if (assignmentResult.vehicle?.id) {
        console.log('[LoginRoute] auth success -> assignment/pre-shift route', {
          vehicleId: assignmentResult.vehicle.id,
        });
        navigation.replace('VehicleAssignment');
        return;
      }

      console.log('[LoginRoute] auth success -> no assignment blocked state route', {
        driverId,
      });
      navigation.replace('VehicleAssignment');
    } catch (error) {
      console.error('[Login] handleSignIn exception', error);
      Alert.alert('Authentication error', error instanceof Error ? error.message : 'Unable to authenticate.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <ScreenContainer title="Driver Login" subtitle="Sign in to start your shift">
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="Enter your work email" autoCapitalize="none" />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry
      />
      <Button label={isSigningIn ? 'Signing In...' : 'Sign In'} onPress={handleSignIn} disabled={isSigningIn} />
      <Text style={styles.helpText}>
        Driver accounts are provisioned by the TransLine admin portal. If access is missing, contact operations.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  helpText: {
    color: '#6B7280',
    marginTop: 4,
  },
});
