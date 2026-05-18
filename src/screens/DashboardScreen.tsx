import React, { useEffect, useMemo, useState } from 'react';
import { formatPerthDateTime } from '../lib/formatPerthDateTime';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import ScreenContainer from '../components/ScreenContainer';
import SkeletonLoader from '../components/SkeletonLoader';
import StatusChip from '../components/StatusChip';
import type { ChipStatus } from '../components/StatusChip';
import { supabase } from '../lib/supabase';
import { useDriver } from '../state/DriverContext';
import { useAppState } from '../state/AppStateContext';
import { useShiftLifecycle } from '../hooks/useShiftLifecycle';
import { COLORS } from '../lib/animations';
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

  const assignmentChipStatus: ChipStatus =
    assignmentStatus === 'assigned' ? 'active' :
    assignmentStatus === 'loading' ? 'loading' :
    'idle';

  const shiftChipStatus: ChipStatus = isShiftActive ? 'active' : 'idle';

  return (
    <ScreenContainer title="Driver Dashboard" subtitle="Connected to your live data">
      <NetworkStatusBanner />

      {loading ? (
        <SkeletonLoader.Card lines={2} />
      ) : (
        <InfoCard title="Driver">
          <Text style={styles.primaryText}>{driverName}</Text>
          {currentProfile?.email ? <Text style={styles.secondaryText}>{currentProfile.email}</Text> : null}
        </InfoCard>
      )}

      {assignmentStatus === 'loading' ? (
        <SkeletonLoader.Card lines={2} />
      ) : (
        <InfoCard title="Assigned Vehicle">
          <View style={styles.rowSpaced}>
            <Text style={styles.primaryText}>{vehicleLabel}</Text>
            <StatusChip
              label={assignmentStatus === 'assigned' ? 'Assigned' : 'Unassigned'}
              status={assignmentChipStatus}
            />
          </View>
          {assignedVehicle?.type ? <Text style={styles.secondaryText}>{assignedVehicle.type}{assignedVehicle.depot ? ` · ${assignedVehicle.depot}` : ''}</Text> : null}
        </InfoCard>
      )}

      <InfoCard title="Shift Status">
        <View style={styles.rowSpaced}>
          <Text style={styles.primaryText}>{isShiftActive ? 'On shift' : 'Ready to start'}</Text>
          <StatusChip
            label={isShiftActive ? 'Active' : 'Idle'}
            status={shiftChipStatus}
          />
        </View>
        {isShiftActive && appState.shiftStartTime ? (
          <Text style={styles.secondaryText}>
            Started {formatPerthDateTime(appState.shiftStartTime)}
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
        label={isRefreshing ? 'Refreshing…' : 'Refresh Data'}
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
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  secondaryText: {
    color: COLORS.textSecondary,
    marginTop: 2,
    fontSize: 13.5,
  },
  rowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  buttonGroup: {
    gap: 10,
  },
});
