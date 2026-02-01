import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function VehicleAssignmentScreen({ navigation }: ScreenProps<'VehicleAssignment'>) {
  const { updateAppState } = useAppState();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAssignment = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;
      if (!userId) {
        navigation.replace('Login');
        return;
      }

      const { data: assignment, error } = await supabase
        .from('vehicle_assignments')
        .select('vehicle_id, unassigned_at')
        .eq('driver_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!assignment || assignment.unassigned_at) {
        setErrorMessage('Vehicle not assigned. Please contact admin.');
        return;
      }

      updateAppState({ vehicleId: assignment.vehicle_id ?? null });
      navigation.replace('PreStartChecklist');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to verify assignment.');
    } finally {
      setLoading(false);
    }
  }, [navigation, updateAppState]);

  useFocusEffect(
    useCallback(() => {
      loadAssignment();
    }, [loadAssignment])
  );

  useEffect(() => {
    if (errorMessage) {
      console.warn('Vehicle assignment check failed:', errorMessage);
    }
  }, [errorMessage]);

  return (
    <ScreenContainer title="Vehicle confirmation" subtitle="Verifying your active assignment">
      <View style={styles.card}>
        <Text style={styles.title}>Vehicle assignment status</Text>
        {loading ? (
          <Text style={styles.meta}>Checking assignment...</Text>
        ) : errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : (
          <Text style={styles.meta}>Assignment confirmed. Redirecting...</Text>
        )}
      </View>
      <Button label="Retry" onPress={loadAssignment} disabled={loading} />
      <Button
        label="Log out"
        variant="ghost"
        onPress={async () => {
          await supabase.auth.signOut();
          updateAppState({ isLoggedIn: false, vehicleId: null });
          Alert.alert('Signed out', 'Please sign in again.');
          navigation.replace('Login');
        }}
        disabled={loading}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  title: {
    color: '#111827',
    fontWeight: '700',
  },
  meta: {
    color: '#6B7280',
  },
  error: {
    color: '#D32F2F',
  },
});
