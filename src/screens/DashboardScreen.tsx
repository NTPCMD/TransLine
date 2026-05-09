import React, { useEffect, useMemo, useState } from 'react';
import { formatPerthDateTime } from '../lib/formatPerthDateTime';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import ScreenContainer from '../components/ScreenContainer';
import { supabase } from '../lib/supabase';
import { useDriver } from '../state/DriverContext';
import { useAppState } from '../state/AppStateContext';
import { useShiftLifecycle } from '../hooks/useShiftLifecycle';
import type { ScreenProps } from '../types/navigation';

export default function DashboardScreen(props: ScreenProps<'Dashboard'>) {
  const { navigation } = props;
  const { currentDriver, currentProfile, loading, reload } = useDriver();
  const { clearSessionState, updateAppState } = useAppState();
  const {
    appState,
    assignedVehicle,
    assignmentStatus,
    isShiftActive,
    refreshAssignment,
    refreshCurrentVehicle,
  } = useShiftLifecycle();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const driverName = useMemo(() => {
    return (
      currentDriver?.name ??
      (typeof currentProfile?.full_name === 'string' ? currentProfile.full_name : null) ??
      'Driver'
    );
  }, [currentDriver?.name, currentProfile?.full_name]);

  const vehicleLabel =
    assignedVehicle?.registration ??
    assignedVehicle?.rego ??
    assignedVehicle?.plate_number ??
    appState.vehicleRegistration ??
    'No assigned vehicle';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([reload(), refreshAssignment(true), refreshCurrentVehicle()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    console.log('[Logout] pressed');
    await clearSessionState();
    console.log('[Logout] state cleared');
    await supabase.auth.signOut();
    console.log('[Logout] signed out');
    console.log('[Navigation] route after logout', { route: 'Login' });
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleStartShift = () => {
    if (assignmentStatus !== 'assigned' || !assignedVehicle?.id) {
      Alert.alert('Vehicle required', 'You need an active vehicle assignment before starting a shift.');
      return;
    }

    updateAppState({ postShiftComplete: false });
    navigation.navigate('VehicleAssignment');
  };

  useEffect(() => {
    if (!isShiftActive && appState.postShiftComplete) {
      console.log('[Routing] blocked auto-start after end shift', {
        activeShiftId: appState.activeShiftId ?? null,
        postShiftComplete: appState.postShiftComplete,
      });
    }
  }, [appState.activeShiftId, appState.postShiftComplete, isShiftActive]);

  useEffect(() => {
    if (!isShiftActive) {
      console.log('[Dashboard] ready to start, no active shift', {
        activeShiftId: appState.activeShiftId ?? null,
      });
    }
  }, [appState.activeShiftId, isShiftActive]);

  return (
    <ScreenContainer title="Driver Dashboard" subtitle="Connected to your live Supabase data">
      <NetworkStatusBanner />

      <InfoCard title="Driver">
        <Text style={styles.primaryText}>{loading ? 'Loading driver profile...' : driverName}</Text>
        <Text style={styles.secondaryText}>User ID: {currentDriver?.user_id ?? currentDriver?.auth_user_id ?? 'Not linked'}</Text>
        {currentProfile?.email ? <Text style={styles.secondaryText}>Email: {currentProfile.email}</Text> : null}
      </InfoCard>

      <InfoCard title="Assigned Vehicle">
        <Text style={styles.primaryText}>{vehicleLabel}</Text>
        <Text style={styles.secondaryText}>Status: {assignmentStatus}</Text>
        {assignedVehicle?.type ? <Text style={styles.secondaryText}>Type: {assignedVehicle.type}</Text> : null}
        {assignedVehicle?.depot ? <Text style={styles.secondaryText}>Depot: {assignedVehicle.depot}</Text> : null}
      </InfoCard>

      <InfoCard title="Shift Lifecycle">
        <Text style={styles.secondaryText}>Shift ID: {appState.activeShiftId ?? 'No active shift'}</Text>
        <Text style={styles.secondaryText}>
          State: {isShiftActive ? 'On shift' : 'Ready to start'}
        </Text>
        {isShiftActive && appState.shiftStartTime ? (
          <Text style={styles.secondaryText}>
            Started: {formatPerthDateTime(appState.shiftStartTime)}
          </Text>
        ) : null}
      </InfoCard>

      {!isShiftActive ? (
        <Button
          label="Start Shift"
          onPress={handleStartShift}
          disabled={loading || assignmentStatus !== 'assigned' || !assignedVehicle?.id}
        />
      ) : (
        <View style={styles.buttonGroup}>
          <Button label="Open Active Shift" onPress={() => navigation.navigate('ActiveShift')} />
          <Button label="End Shift" variant="secondary" onPress={() => navigation.navigate('EndShift')} />
        </View>
      )}

      <Button
        label={isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        variant="ghost"
        onPress={handleRefresh}
        disabled={isRefreshing}
      />
      <Button label="Profile" variant="ghost" onPress={() => navigation.navigate('Profile')} />
      <Button label="Sign Out" variant="ghost" onPress={handleSignOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  primaryText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryText: {
    color: '#4B5563',
    marginTop: 4,
  },
  buttonGroup: {
    gap: 10,
  },
});
