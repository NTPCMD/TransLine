import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { useActiveAssignment } from '../state/AssignmentContext';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function VehicleAssignmentScreen(props: ScreenProps<'VehicleAssignment'>) {
  const { navigation } = props;
  const { status, vehicle, error, refresh } = useActiveAssignment();
  const { state, clearSessionState, updateAppState } = useAppState();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const loadAssignment = useCallback(async () => {
    setErrorMessage(null);
    try {
      await refresh(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to verify assignment.');
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      loadAssignment();
    }, [loadAssignment])
  );

  useEffect(() => {
    if (status === 'error') {
      setErrorMessage(error ?? 'Unable to verify assignment.');
    } else if (status === 'unassigned') {
      setErrorMessage('Vehicle not assigned. Please contact admin.');
    } else if (status === 'loading') {
      setErrorMessage(null);
    }
  }, [status, error]);

  const handleStartChecklist = () => {
    if (!vehicle?.id) {
      setErrorMessage('Vehicle not assigned. Please contact admin.');
      return;
    }
    updateAppState({ postShiftComplete: false });
    navigation.navigate('PreStartChecklist', { vehicleId: vehicle.id });
  };

  const handleStartNewShift = () => {
    if (!vehicle?.id) {
      setErrorMessage('Vehicle not assigned. Please contact admin.');
      return;
    }
    updateAppState({ postShiftComplete: false });
    navigation.navigate('StartShift');
  };

  const vehicleLabel = vehicle?.rego
    ? `${vehicle.rego}${vehicle.make || vehicle.model ? ` — ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}` : ''}`
    : null;

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
            <Text style={styles.vehicleText}>{vehicleLabel ?? 'Unknown vehicle'}</Text>
            {vehicle?.id ? <Text style={styles.meta}>Vehicle ID: {vehicle.id}</Text> : null}
          </View>
        )}
      </View>

      {state.postShiftComplete ? (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>Shift complete</Text>
          <Text style={styles.completeText}>You are now off shift. Start a new shift when you are ready.</Text>
        </View>
      ) : null}

      {state.postShiftComplete ? (
        <Button
          label="Start New Shift"
          onPress={handleStartNewShift}
          disabled={status !== 'assigned' || !vehicle}
        />
      ) : (
        <>
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
        </>
      )}
      <Button
        label="Refresh assignment"
        variant="ghost"
        onPress={loadAssignment}
        disabled={status === 'loading'}
      />
      <Button
        label="Log out"
        variant="ghost"
        onPress={async () => {
          console.log('[Logout] pressed');
          await clearSessionState();
          console.log('[Logout] state cleared');
          await supabase.auth.signOut();
          console.log('[Logout] signed out');
          Alert.alert('Signed out', 'Please sign in again.');
          console.log('[Navigation] route after logout', { route: 'Login' });
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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
  completeCard: {
    backgroundColor: '#ECFDF3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    gap: 4,
  },
  completeTitle: {
    color: '#065F46',
    fontWeight: '700',
  },
  completeText: {
    color: '#065F46',
  },
});
