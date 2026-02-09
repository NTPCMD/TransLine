import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { useActiveAssignment } from '../state/AssignmentContext';
import type { ScreenProps } from '../types/navigation';

export default function VehicleAssignmentScreen(props: ScreenProps<'VehicleAssignment'>) {
  const { navigation } = props;
  const { status, vehicle, error, refresh } = useActiveAssignment();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const loadAssignment = useCallback(async () => {
    setErrorMessage(null);
    try {
      await refresh(true);
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
    if (status === 'error') {
      setErrorMessage(error ?? 'Unable to verify assignment.');
      return;
    }
    if (status === 'unassigned') {
      setErrorMessage('Vehicle not assigned. Please contact admin.');
      return;
    }
    if (status === 'loading') {
      setErrorMessage(null);
    }
  }, [status, error]);

  const handleStartChecklist = () => {
    if (!vehicle?.id) {
      setErrorMessage('Vehicle not assigned. Please contact admin.');
      return;
    }
    navigation.navigate('PreStartChecklist', { vehicleId: vehicle.id });
  };

  return (
    <ScreenContainer title="Vehicle assignment" subtitle="Confirm your assigned vehicle before starting">
      <View style={styles.card}>
        <Text style={styles.title}>Assigned vehicle</Text>
        {status === 'loading' ? (
          <Text style={styles.meta}>Checking assignment...</Text>
        ) : errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : (
          <View>
            <Text style={styles.vehicleText}>
              {vehicle?.label ?? vehicle?.registration ?? vehicle?.rego ?? vehicle?.plate_number ?? 'Unknown registration'}
            </Text>
            {vehicle?.type ? <Text style={styles.meta}>Type: {vehicle.type}</Text> : null}
            {vehicle?.depot ? <Text style={styles.meta}>Depot: {vehicle.depot}</Text> : null}
            {vehicle?.id ? <Text style={styles.meta}>Vehicle ID: {vehicle.id}</Text> : null}
          </View>
        )}
      </View>
      <Pressable
        onPress={() => setIsConfirmed(prev => !prev)}
        style={[styles.checkboxRow, (status !== 'assigned' || !vehicle) && styles.checkboxRowDisabled]}
        disabled={status !== 'assigned' || !vehicle}
      >
        <View style={[styles.checkbox, isConfirmed && styles.checkboxChecked]}>
          {isConfirmed ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.checkboxLabel}>I confirm this is the vehicle I'm inspecting</Text>
      </Pressable>
      <Button
        label="Start Pre-Start Inspection"
        onPress={handleStartChecklist}
        disabled={status !== 'assigned' || !vehicle || !isConfirmed}
      />
      <Button label="Refresh assignment" variant="ghost" onPress={loadAssignment} disabled={status === 'loading'} />
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  checkboxRowDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  checkboxMark: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    color: '#111827',
    flex: 1,
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
