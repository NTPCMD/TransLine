import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import ScreenContainer from '../components/ScreenContainer';
import { useAppState } from '../state/AppStateContext';
import { useDriver } from '../state/DriverContext';
import type { ScreenProps } from '../types/navigation';

export default function ActiveShiftScreen({ navigation }: ScreenProps<'ActiveShift'>) {
  const { state } = useAppState();
  const { currentDriver: driver, currentVehicle: assigned } = useDriver();
  const [now, setNow] = useState(Date.now());
  const [showMenu, setShowMenu] = useState(false);
  const [hasLocationFix, setHasLocationFix] = useState(false);
  const [driverCoordinate, setDriverCoordinate] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [lastFixTime, setLastFixTime] = useState<Date | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus>('undetermined');
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const trackingActive = Boolean(state.shiftStartTime);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const updatePermissionStatus = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(status);
    return status;
  };

  const handleLocationUpdate = (location: Location.LocationObject) => {
    setHasLocationFix(true);
    setLastFixTime(new Date(location.timestamp));
    setDriverCoordinate([location.coords.longitude, location.coords.latitude]);
    if (typeof location.coords.heading === 'number' && !Number.isNaN(location.coords.heading)) {
      setDriverHeading(location.coords.heading);
    }
  };

  const startLocationWatch = async () => {
    const status = await updatePermissionStatus();
    if (status !== 'granted' || watchRef.current) return;
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 5,
        timeInterval: 5000,
      },
      handleLocationUpdate
    );
  };

  useEffect(() => {
    updatePermissionStatus();
  }, []);

  useEffect(() => {
    if (!trackingActive) {
      watchRef.current?.remove();
      watchRef.current = null;
      return;
    }

    startLocationWatch();

    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [trackingActive]);

  const handleRequestPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status === 'granted' && trackingActive) {
      await startLocationWatch();
    }
  };

  const handleRefreshLocation = async () => {
    const status = await updatePermissionStatus();
    if (status !== 'granted') return;
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    handleLocationUpdate(location);
  };

  const formatCoordinate = (coordinate: [number, number] | null) => {
    if (!coordinate) return 'Not available';
    return `${coordinate[1].toFixed(5)}, ${coordinate[0].toFixed(5)}`;
  };

  const formatTime = (time: Date | null) => {
    if (!time) return 'Not available';
    return time.toLocaleTimeString();
  };

  const formatPermission = (status: Location.PermissionStatus) => {
    if (status === 'granted') return 'Granted';
    if (status === 'denied') return 'Denied';
    return 'Not requested';
  };

  const getShiftDuration = () => {
    if (!state.shiftStartTime) return '0h 0m';
    const diff = Date.now() - new Date(state.shiftStartTime).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <ScreenContainer>
      {/* Top banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <View style={styles.dot} />
          <View>
            <Text style={styles.bannerText}>ON SHIFT</Text>
            <Text style={{ color: '#fff', fontSize: 12 }}>
              {driver?.name ?? 'Driver'} • {state.vehicleRegistration ?? assigned?.registration ?? 'No vehicle'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
          <Text style={{ color: '#fff' }}>Menu</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Duration</Text>
          <Text style={styles.metricValue}>{getShiftDuration()}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>GPS</Text>
          <Text style={styles.metricValue}>{'Active'}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Sync</Text>
          <Text style={styles.metricValue}>Just now</Text>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <InfoCard title="Location status">
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Tracking</Text>
            <Text style={styles.statusValue}>{trackingActive ? 'Active' : 'Paused'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>GPS permission</Text>
            <Text style={styles.statusValue}>{formatPermission(permissionStatus)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last fix</Text>
            <Text style={styles.statusValue}>{formatTime(lastFixTime)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last coordinates</Text>
            <Text style={styles.statusValue}>{formatCoordinate(driverCoordinate)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Heading</Text>
            <Text style={styles.statusValue}>{driverHeading !== null ? `${driverHeading.toFixed(0)}°` : 'Not available'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Fix status</Text>
            <Text style={styles.statusValue}>{hasLocationFix ? 'Fix acquired' : 'Waiting for fix'}</Text>
          </View>
          <View style={styles.buttonRow}>
            <Button label="Request GPS Permissions" variant="secondary" onPress={handleRequestPermissions} />
            <Button label="Refresh Location" variant="ghost" onPress={handleRefreshLocation} />
          </View>
        </InfoCard>

        <View style={{ marginTop: 12 }}>
          <Button label="Something Gone Wrong" onPress={() => navigation.navigate('IncidentReport')} />
        </View>

        <View style={styles.grid}>
          <Button label="Break" variant="outline" onPress={() => navigation.navigate('BreakControl')} />
          <Button label="Fuel Log" variant="outline" onPress={() => navigation.navigate('FuelLog')} />
          <Button label="Send Note" variant="outline" onPress={() => navigation.navigate('SendNote')} />
          <Button label="Shift Details" variant="outline" onPress={() => navigation.navigate('ShiftDetails')} />
        </View>

        <View style={{ marginTop: 20 }}>
          <Button label="Log Off" variant="secondary" onPress={() => navigation.navigate('EndShift')} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#C62828',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  bannerText: {
    color: '#fff',
    fontWeight: '700',
  },
  menuButton: {
    padding: 8,
  },
  metricsRow: {
    backgroundColor: '#F2F2F2',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: { alignItems: 'center', flex: 1 },
  metricLabel: { color: '#9E9E9E', fontSize: 12 },
  metricValue: { fontWeight: '700', marginTop: 6 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  statusValue: {
    fontWeight: '600',
    fontSize: 12,
    color: '#111827',
    textAlign: 'right',
    flexShrink: 1,
  },
  buttonRow: {
    marginTop: 12,
    gap: 8,
  },
  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
});
