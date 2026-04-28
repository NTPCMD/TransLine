import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import ScreenContainer from '../components/ScreenContainer';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import { useAppState } from '../state/AppStateContext';
import { useDriver } from '../state/DriverContext';
import type { ScreenProps } from '../types/navigation';

const SAMPLE_INTERVAL_MS = 3 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;
const STOP_RADIUS_METERS = 75;
const STOP_MIN_DURATION_MS = 3 * 60 * 1000;

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceMeters = (
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) => {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(latitudeB - latitudeA);
  const dLon = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

export default function ActiveShiftScreen(props: ScreenProps<'ActiveShift'>) {
  const { navigation } = props;
  const { state, createEvent } = useAppState();
  const { currentDriver: driver, currentVehicle: assigned } = useDriver();
  const [menuVisible, setMenuVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hasLocationFix, setHasLocationFix] = useState(false);
  const [driverCoordinate, setDriverCoordinate] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [lastFixTime, setLastFixTime] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [nextPollAt, setNextPollAt] = useState<number | null>(null);
  const [nextUploadAt, setNextUploadAt] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus>(Location.PermissionStatus.UNDETERMINED);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSamplingRef = useRef(false);
  const lastHeartbeatAtRef = useRef<number | null>(null);
  const stopCandidateRef = useRef<{
    startTimeMs: number;
    anchorLatitude: number;
    anchorLongitude: number;
    reported: boolean;
  } | null>(null);
  const redirectHandledRef = useRef(false);
  const shiftIsActive = Boolean(state.activeShiftId);
  const assignmentVehicleId = assigned?.id ?? null;
  const resolvedVehicleObject = useMemo(
    () => ({
      id: state.vehicleId ?? assigned?.id ?? null,
      registration: state.vehicleRegistration ?? assigned?.registration ?? assigned?.rego ?? assigned?.plate_number ?? null,
    }),
    [
      assigned?.id,
      assigned?.plate_number,
      assigned?.registration,
      assigned?.rego,
      state.vehicleId,
      state.vehicleRegistration,
    ]
  );
  const finalVehicleLabel = resolvedVehicleObject.registration ?? 'No vehicle';
  const shiftVehicleId = state.activeShiftVehicleId ?? state.vehicleId ?? null;
  const hasShiftVehicleConflict =
    shiftIsActive &&
    (
      Boolean(state.activeShiftVehicleResolutionError) ||
      !state.activeShiftId ||
      !shiftVehicleId ||
      finalVehicleLabel === 'No vehicle'
    );
  const shiftConflictMessage =
    state.activeShiftVehicleResolutionError ??
    'Shift data conflict: active shift is missing linked vehicle details.';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const updatePermissionStatus = async (requestIfNeeded = false) => {
    let { status } = await Location.getForegroundPermissionsAsync();

    if (requestIfNeeded && status !== Location.PermissionStatus.GRANTED) {
      const requested = await Location.requestForegroundPermissionsAsync();
      status = requested.status;
    }

    setPermissionStatus(status);
    return status;
  };

  const handleLocationUpdate = (location: Location.LocationObject) => {
    setHasLocationFix(true);
    // Use local receipt time so manual refresh always visibly updates "Last fix".
    setLastFixTime(new Date());
    setDriverCoordinate([location.coords.longitude, location.coords.latitude]);
    if (typeof location.coords.heading === 'number' && !Number.isNaN(location.coords.heading)) {
      setDriverHeading(location.coords.heading);
    }
  };

  const resetTrackingState = () => {
    lastHeartbeatAtRef.current = null;
    stopCandidateRef.current = null;
    isSamplingRef.current = false;
  };

  const pollAndSyncLocation = async (activeShiftId: string | null) => {
    if (isSamplingRef.current) {
      return;
    }
    isSamplingRef.current = true;

    try {
    const status = await updatePermissionStatus();
    if (status !== Location.PermissionStatus.GRANTED) return;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    handleLocationUpdate(location);

    if (activeShiftId) {
      const sampleTimeMs = Date.now();
      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      const existingCandidate = stopCandidateRef.current;
      if (!existingCandidate) {
        stopCandidateRef.current = {
          startTimeMs: sampleTimeMs,
          anchorLatitude: latitude,
          anchorLongitude: longitude,
          reported: false,
        };
      } else {
        const distanceMeters = haversineDistanceMeters(
          existingCandidate.anchorLatitude,
          existingCandidate.anchorLongitude,
          latitude,
          longitude
        );

        if (distanceMeters <= STOP_RADIUS_METERS) {
          const durationMs = sampleTimeMs - existingCandidate.startTimeMs;
          if (!existingCandidate.reported && durationMs >= STOP_MIN_DURATION_MS) {
            const durationSeconds = Math.floor(durationMs / 1000);
            const stopEventResult = await createEvent(
              'stop_detected',
              {
                start_time: new Date(existingCandidate.startTimeMs).toISOString(),
                end_time: new Date(sampleTimeMs).toISOString(),
                duration_seconds: durationSeconds,
                radius_m: STOP_RADIUS_METERS,
              },
              {
                locationOverride: {
                  latitude,
                  longitude,
                },
              }
            );

            if (stopEventResult.status === 'sent' || stopEventResult.status === 'queued') {
              stopCandidateRef.current = {
                ...existingCandidate,
                reported: true,
              };
            } else {
              console.warn('[ActiveShiftPolling] Failed to persist stop_detected event', {
                activeShiftId,
                error: stopEventResult.error,
              });
            }
          }
        } else {
          stopCandidateRef.current = {
            startTimeMs: sampleTimeMs,
            anchorLatitude: latitude,
            anchorLongitude: longitude,
            reported: false,
          };
        }
      }

      const shouldSendHeartbeat =
        lastHeartbeatAtRef.current === null ||
        sampleTimeMs - lastHeartbeatAtRef.current >= HEARTBEAT_INTERVAL_MS;

      if (shouldSendHeartbeat) {
        const heartbeatResult = await createEvent(
          'location',
          {
            source: 'tracking_heartbeat',
            sample_interval_seconds: SAMPLE_INTERVAL_MS / 1000,
            heartbeat_interval_seconds: HEARTBEAT_INTERVAL_MS / 1000,
          },
          {
            locationOverride: {
              latitude,
              longitude,
            },
          }
        );

        if (heartbeatResult.status === 'sent' || heartbeatResult.status === 'queued') {
          lastHeartbeatAtRef.current = sampleTimeMs;
          setNextUploadAt(sampleTimeMs + HEARTBEAT_INTERVAL_MS);
          console.log('[Tracking] next upload', {
            activeShiftId,
            at: new Date(sampleTimeMs + HEARTBEAT_INTERVAL_MS).toISOString(),
          });
        } else {
          console.warn('[ActiveShiftPolling] Failed to persist location heartbeat event', {
            activeShiftId,
            error: heartbeatResult.error,
          });
        }
      }
    }
    } finally {
      isSamplingRef.current = false;
    }
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    resetTrackingState();
    setIsPolling(false);
    setNextPollAt(null);
    setNextUploadAt(null);
  };

  const startPollingLoop = (activeShiftId: string) => {
    stopPolling();
    console.log('[Tracking] timers started', { activeShiftId, gpsIntervalMs: SAMPLE_INTERVAL_MS, uploadIntervalMs: HEARTBEAT_INTERVAL_MS });
    pollingIntervalRef.current = setInterval(() => {
      setNow(Date.now());
      const nextGpsCheckAt = Date.now() + SAMPLE_INTERVAL_MS;
      setNextPollAt(nextGpsCheckAt);
      console.log('[Tracking] next GPS check', { activeShiftId, at: new Date(nextGpsCheckAt).toISOString() });
      void pollAndSyncLocation(activeShiftId);
    }, SAMPLE_INTERVAL_MS);
    setIsPolling(true);
    setNow(Date.now());
    const nextGpsCheckAt = Date.now() + SAMPLE_INTERVAL_MS;
    const nextUploadAtMs = Date.now() + HEARTBEAT_INTERVAL_MS;
    setNextPollAt(nextGpsCheckAt);
    setNextUploadAt(nextUploadAtMs);
    console.log('[Tracking] next GPS check', { activeShiftId, at: new Date(nextGpsCheckAt).toISOString() });
    console.log('[Tracking] next upload', { activeShiftId, at: new Date(nextUploadAtMs).toISOString() });
  };

  useEffect(() => {
    // On app/screen open, request permission if needed so tracking can auto-start.
    void updatePermissionStatus(true);
  }, []);

  useEffect(() => {
    const activeShiftId = state.activeShiftId ?? null;
    console.log('[Tracking] activeShiftId', { activeShiftId });
    if (!activeShiftId) {
      stopPolling();
      return;
    }

    console.log('[Tracking] start requested', {
      activeShiftId,
      shiftStartTime: state.shiftStartTime ? new Date(state.shiftStartTime).toISOString() : null,
      activeShiftVehicleId: state.activeShiftVehicleId ?? null,
    });

    let isCancelled = false;

    const startPolling = async () => {
      const status = await updatePermissionStatus(true);
      if (isCancelled || status !== Location.PermissionStatus.GRANTED) {
        setIsPolling(false);
        return;
      }

      await pollAndSyncLocation(activeShiftId);
      if (isCancelled) return;
      startPollingLoop(activeShiftId);
    };

    void startPolling();

    return () => {
      isCancelled = true;
      stopPolling();
    };
  }, [state.activeShiftId, state.activeShiftVehicleId, state.shiftStartTime]);

  useEffect(() => {
    if (state.activeShiftId) {
      redirectHandledRef.current = false;
      return;
    }

    if (redirectHandledRef.current) {
      return;
    }

    redirectHandledRef.current = true;
    console.log('[ActiveShift] redirect skipped after endShift clear');
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [navigation, state.activeShiftId]);

  useEffect(() => {
    if (!state.activeShiftId) {
      return;
    }
    console.log('[ActiveShiftRender]', {
      activeShiftId: state.activeShiftId ?? null,
      shiftVehicleId,
      resolvedVehicleObject,
      assignmentVehicleId,
      finalRenderedVehicleLabel: finalVehicleLabel,
    });
  }, [
    assignmentVehicleId,
    finalVehicleLabel,
    resolvedVehicleObject,
    shiftVehicleId,
    state.activeShiftId,
  ]);

  const handleRequestPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status === Location.PermissionStatus.GRANTED && state.activeShiftId) {
      await pollAndSyncLocation(state.activeShiftId);
      startPollingLoop(state.activeShiftId);
    }
  };

  const handleRefreshLocation = async () => {
    const status = await updatePermissionStatus();
    if (status !== Location.PermissionStatus.GRANTED) return;

    const activeShiftId = state.activeShiftId ?? null;
    await pollAndSyncLocation(activeShiftId);

    if (activeShiftId) {
      // Manual refresh also (re)starts the automatic 3-minute sampling loop.
      startPollingLoop(activeShiftId);
    }
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
    if (status === Location.PermissionStatus.GRANTED) return 'Granted';
    if (status === Location.PermissionStatus.DENIED) return 'Denied';
    return 'Not requested';
  };

  const secondsUntilNextPoll =
    isPolling && nextPollAt
      ? Math.max(0, Math.ceil((nextPollAt - Date.now()) / 1000))
      : null;

  const secondsUntilNextUpload =
    isPolling && nextUploadAt
      ? Math.max(0, Math.ceil((nextUploadAt - Date.now()) / 1000))
      : null;

  const formatCountdown = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getShiftDuration = () => {
    if (!state.shiftStartTime) return '0h 0m';
    const diff = Date.now() - new Date(state.shiftStartTime).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (!state.activeShiftId) {
    return null;
  }

  return (
    <ScreenContainer>
      <NetworkStatusBanner />
      {/* Top banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <View style={styles.dot} />
          <View>
            <Text style={styles.bannerText}>ON SHIFT</Text>
            <Text style={{ color: '#fff', fontSize: 12 }}>
              {driver?.name ?? 'Driver'} • {finalVehicleLabel}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
          <Text style={{ color: '#fff' }}>Menu</Text>
        </TouchableOpacity>

        <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
            <SafeAreaView style={styles.menuPanel}>
              <Text style={styles.menuTitle}>Navigation</Text>
              {([
                { label: 'Announcements', screen: 'Announcements' },
                { label: 'Medical Absence', screen: 'MedicalAbsence' },
                { label: 'Vehicle Maintenance', screen: 'VehicleMaintenanceLog' },
                { label: 'Profile', screen: 'Profile' },
                { label: 'Shift History', screen: 'ShiftHistory' },
                { label: 'Operations Alerts', screen: 'OperationsAlerts' },
              ] as const).map(({ label, screen }) => (
                <TouchableOpacity
                  key={screen}
                  style={styles.menuItem}
                  onPress={() => { setMenuVisible(false); navigation.navigate(screen as any); }}
                >
                  <Text style={styles.menuItemText}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.menuItem, styles.menuItemClose]} onPress={() => setMenuVisible(false)}>
                <Text style={[styles.menuItemText, { color: '#6B7280' }]}>Close</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </Pressable>
        </Modal>
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
        {hasShiftVehicleConflict ? (
          <View style={styles.conflictCard}>
            <Text style={styles.conflictTitle}>Shift data conflict</Text>
            <Text style={styles.conflictBody}>{shiftConflictMessage}</Text>
          </View>
        ) : null}

        <InfoCard title="Location status">
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Tracking</Text>
            <Text style={styles.statusValue}>{isPolling ? 'Active' : 'Paused'}</Text>
          </View>
          {!state.activeShiftId ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Tracking reason</Text>
              <Text style={styles.statusValue}>No active shift</Text>
            </View>
          ) : null}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>GPS permission</Text>
            <Text style={styles.statusValue}>{formatPermission(permissionStatus)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last fix</Text>
            <Text style={styles.statusValue}>{formatTime(lastFixTime)}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Next GPS check</Text>
            <Text style={styles.statusValue}>
              {secondsUntilNextPoll !== null ? formatCountdown(secondsUntilNextPoll) : 'Not scheduled'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Next upload</Text>
            <Text style={styles.statusValue}>
              {secondsUntilNextUpload !== null ? formatCountdown(secondsUntilNextUpload) : 'Pending first heartbeat'}
            </Text>
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
          <Button
            label={hasShiftVehicleConflict ? 'Report Shift Data Conflict' : 'Something Gone Wrong'}
            onPress={() => navigation.navigate('IncidentReport')}
          />
        </View>

        <View style={styles.grid}>
          <Button label="Break" variant="ghost" onPress={() => navigation.navigate('BreakControl')} />
          <Button label="Fuel Log" variant="ghost" onPress={() => navigation.navigate('FuelLog')} />
          <Button label="Send Note" variant="ghost" onPress={() => navigation.navigate('SendNote')} />
          <Button label="Shift Details" variant="ghost" onPress={() => navigation.navigate('ShiftDetails')} />
        </View>

        <View style={{ marginTop: 12 }}>
          <Button 
            label={`Offline Queue ${state.queuedEventsCount > 0 ? `(${state.queuedEventsCount})` : ''}`} 
            variant="ghost" 
            onPress={() => navigation.navigate('OfflineQueue')} 
          />
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  menuPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemClose: {
    borderBottomWidth: 0,
    marginTop: 8,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: '#111827',
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
  conflictCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D32F2F',
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 10,
  },
  conflictTitle: {
    color: '#B71C1C',
    fontWeight: '700',
    marginBottom: 4,
  },
  conflictBody: {
    color: '#7F1D1D',
    fontSize: 12,
  },
});
