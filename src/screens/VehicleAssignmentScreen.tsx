import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { useActiveAssignment } from '../state/AssignmentContext';
import type { ScreenProps } from '../types/navigation';

export default function VehicleAssignmentScreen({ navigation }: ScreenProps<'VehicleAssignment'>) {
  const { status, vehicle, error, refresh } = useActiveAssignment();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAssignment = useCallback(async () => {
    setErrorMessage(null);
    try {
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to verify assignment.');
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      loadAssignment();
    }, [loadAssignment])
  );

  useEffect(() => {
    if (error) {
      console.warn('Vehicle assignment check failed:', error);
    }
  }, [error]);

  useEffect(() => {
    if (status === 'assigned') {
      navigation.replace('PreStartChecklist');
    }
    if (status === 'error') {
      setErrorMessage(error ?? 'Unable to verify assignment.');
    }
    if (status === 'unassigned') {
      setErrorMessage('Vehicle not assigned. Please contact admin.');
    }
    if (status === 'loading') {
      setErrorMessage(null);
    }
  }, [status, error, navigation]);

  return (
    <ScreenContainer title="Vehicle confirmation" subtitle="Verifying your active assignment">
      <View style={styles.card}>
        <Text style={styles.title}>Vehicle assignment status</Text>
        {status === 'loading' ? (
          <Text style={styles.meta}>Checking assignment...</Text>
        ) : errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : (
          <View>
            <Text style={styles.meta}>Assigned vehicle</Text>
            <Text style={styles.vehicleText}>{vehicle?.registration ?? 'Unknown registration'}</Text>
            {vehicle?.name ? <Text style={styles.meta}>{vehicle.name}</Text> : null}
            {vehicle?.type ? <Text style={styles.meta}>{vehicle.type}</Text> : null}
            {vehicle?.depot ? <Text style={styles.meta}>{vehicle.depot}</Text> : null}
          </View>
        )}
      </View>
      <Button label="Retry" onPress={loadAssignment} disabled={status === 'loading'} />
      <Button
        label="Log out"
        variant="ghost"
        onPress={async () => {
          await supabase.auth.signOut();
          Alert.alert('Signed out', 'Please sign in again.');
          navigation.replace('Login');
        }}
        disabled={status === 'loading'}
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
  vehicleText: {
    color: '#111827',
    fontWeight: '700',
    marginTop: 4,
  },
});
