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
import { useActiveShift } from '../state/ActiveShiftContext';

const SAMPLE_INTERVAL_MS = 3 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;
const STOP_RADIUS_METERS = 75;
const STOP_MIN_DURATION_MS = 3 * 60 * 1000;

const toRadians = (v: number) => (v * Math.PI) / 180;

const haversineDistanceMeters = (latA: number, lonA: number, latB: number, lonB: number) => {
  const R = 6371000;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MENU_ITEMS = [
  { label: 'Announcements', screen: 'Announcements' },
  { label: 'Medical Absence', screen: 'MedicalAbsence' },
  { label: 'Vehicle Maintenance', screen: 'VehicleMaintenanceLog' },
  { label: 'Profile', screen: 'Profile' },
  { label: 'Shift History', screen: 'ShiftHistory' },
  { label: 'Operations Alerts', screen: 'OperationsAlerts' },
] as const;

const NAV_BUTTONS = [
  ['Break', 'BreakControl'],
  ['Fuel Log', 'FuelLog'],
  ['Send Note', 'SendNote'],
  ['Shift Details', 'ShiftDetails'],
] as const;

type StopCandidate = {
  startTimeMs: number;
  anchorLatitude: number;
  anchorLongitude: number;
  reported: boolean; // prevents duplicate stop events at same location
};

export default function ActiveShiftScreen({ navigation }: ScreenProps<'ActiveShift'>) {
  const { state, createEvent } = useAppState();
  const { currentDriver: driver, currentVehicle: assigned } = useDriver();
  const { shift: activeShift } = useActiveShift();

  const [menuVisible, setMenuVisible] = useState(false);
  const [now, setNow] = useState(Date.now()); // ticks every second to keep countdowns live
  const [hasLocationFix, setHasLocationFix] = useState(false);
  const [driverCoordinate, setDriverCoordinate] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [lastFixTime, setLastFixTime] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [nextPollAt, setNextPollAt] = useState<number | null>(null);
  const [nextUploadAt, setNextUploadAt] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus>(Location.PermissionStatus.UNDETERMINED);

  // Refs hold tracking state that shouldn't trigger re-renders
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSamplingRef = useRef(false);
  const lastHeartbeatAtRef = useRef<number | null>(null);
  const stopCandidateRef = useRef<StopCandidate | null>(null);
  const redirectHandledRef = useRef(false);

  // Vehicle label resolution
  const finalVehicleLabel = useMemo(
    () => state.vehicleRegistration ?? assigned?.registration ?? assigned?.rego ?? assigned?.plate_number ?? 'No vehicle',
    [state.vehicleRegistration, assigned]
  );
  const shiftVehicleId = state.activeShiftVehicleId ?? state.vehicleId ?? null;
  const hasShiftVehicleConflict = Boolean(state.activeShiftId) && (
    Boolean(state.activeShiftVehicleResolutionError) || !shiftVehicleId || finalVehicleLabel === 'No vehicle'
  );
  const shiftConflictMessage = state.activeShiftVehicleResolutionError ?? 'Shift data conflict: active shift is missing linked vehicle details.';

  // Tick every second so countdown timers stay accurate
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const updatePermissionStatus = async (requestIfNeeded = false) => {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (requestIfNeeded && status !== Location.PermissionStatus.GRANTED) {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    setPermissionStatus(status);
    return status;
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    // Reset all tracking state together
    setIsPolling(false);
    setNextPollAt(null);
    setNextUploadAt(null);
    lastHeartbeatAtRef.current = null;
    stopCandidateRef.current = null;
    isSamplingRef.current = false;
  };

  // Fetches GPS, runs stop detection, and sends a heartbeat if one is due
  const pollAndSyncLocation = async (shiftId: string | null) => {
    if (isSamplingRef.current) return; // prevent overlapping polls
    isSamplingRef.current = true;
    try {
      const status = await updatePermissionStatus();
      if (status !== Location.PermissionStatus.GRANTED) return;

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude, heading } = location.coords;

      setHasLocationFix(true);
      setLastFixTime(new Date());
      setDriverCoordinate([longitude, latitude]);
      if (typeof heading === 'number' && !Number.isNaN(heading)) setDriverHeading(heading);

      if (!shiftId) return;

      const sampleTime = Date.now();

      // --- Stop detection ---
      // Uses an anchor + radius approach. Once a stop is reported at a location,
      // `reported` is flagged true so it won't fire again unless the driver leaves and returns.
      const candidate = stopCandidateRef.current;
      if (!candidate) {
        stopCandidateRef.current = { startTimeMs: sampleTime, anchorLatitude: latitude, anchorLongitude: longitude, reported: false };
      } else {
        const dist = haversineDistanceMeters(candidate.anchorLatitude, candidate.anchorLongitude, latitude, longitude);
        if (dist <= STOP_RADIUS_METERS) {
          const durationMs = sampleTime - candidate.startTimeMs;
          if (!candidate.reported && durationMs >= STOP_MIN_DURATION_MS) {
            const result = await createEvent(
              'stop_detected',
              {
                start_time: new Date(candidate.startTimeMs).toISOString(),
                end_time: new Date(sampleTime).toISOString(),
                duration_seconds: Math.floor(durationMs / 1000),
                radius_m: STOP_RADIUS_METERS,
              },
              { locationOverride: { latitude, longitude } },
              shiftId
            );
            if (result.status === 'sent' || result.status === 'queued') {
              // Mark reported so we don't re-fire until driver moves away
              stopCandidateRef.current = { ...candidate, reported: true };
            } else {
              console.warn('[Tracking] stop_detected failed', result.error);
            }
          }
        } else {
          // Driver moved outside radius — reset anchor for next stop detection
          stopCandidateRef.current = { startTimeMs: sampleTime, anchorLatitude: latitude, anchorLongitude: longitude, reported: false };
        }
      }

      // --- Heartbeat (fires every HEARTBEAT_INTERVAL_MS) ---
      const shouldHeartbeat = lastHeartbeatAtRef.current === null || sampleTime - lastHeartbeatAtRef.current >= HEARTBEAT_INTERVAL_MS;
      if (shouldHeartbeat) {
        const result = await createEvent(
          'location',
          { source: 'tracking_heartbeat', sample_interval_seconds: SAMPLE_INTERVAL_MS / 1000, heartbeat_interval_seconds: HEARTBEAT_INTERVAL_MS / 1000 },
          { locationOverride: { latitude, longitude } },
          shiftId
        );
        if (result.status === 'sent' || result.status === 'queued') {
          lastHeartbeatAtRef.current = sampleTime;
          setNextUploadAt(sampleTime + HEARTBEAT_INTERVAL_MS);
        } else {
          console.warn('[Tracking] heartbeat failed', result.error);
        }
      }
    } finally {
      isSamplingRef.current = false;
    }
  };

  const startPollingLoop = (shiftId: string) => {
    pollingIntervalRef.current = setInterval(() => {
      setNow(Date.now());
      setNextPollAt(Date.now() + SAMPLE_INTERVAL_MS);
      void pollAndSyncLocation(shiftId);
    }, SAMPLE_INTERVAL_MS);
    setIsPolling(true);
    setNextPollAt(Date.now() + SAMPLE_INTERVAL_MS);
    setNextUploadAt(Date.now() + HEARTBEAT_INTERVAL_MS);
  };

  // Start/restart tracking whenever the active shift changes
  useEffect(() => {
    const shiftId = activeShift?.id ?? null;
    if (!shiftId) { stopPolling(); return; }

    let cancelled = false;
    (async () => {
      const status = await updatePermissionStatus(true);
      if (cancelled || status !== Location.PermissionStatus.GRANTED) { setIsPolling(false); return; }
      await pollAndSyncLocation(shiftId);
      if (!cancelled) startPollingLoop(shiftId);
    })();

    return () => { cancelled = true; stopPolling(); };
  }, [state.activeShiftId, activeShift?.vehicle_id, activeShift?.started_at]);

  // Redirect to Dashboard when shift ends
  useEffect(() => {
    if (activeShift?.id) { redirectHandledRef.current = false; return; }
    if (redirectHandledRef.current) return;
    redirectHandledRef.current = true;
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [activeShift?.id]);

  // Request permissions on mount
  useEffect(() => { void updatePermissionStatus(true); }, []);

  const handleRequestPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    if (status === Location.PermissionStatus.GRANTED && activeShift?.id) {
      await pollAndSyncLocation(activeShift.id);
      startPollingLoop(activeShift.id);
    }
  };

  const handleRefreshLocation = async () => {
    const status = await updatePermissionStatus();
    if (status !== Location.PermissionStatus.GRANTED) return;
    const shiftId = activeShift?.id ?? null;
    await pollAndSyncLocation(shiftId);
    if (shiftId) startPollingLoop(shiftId);
  };

  // Formatting helpers
  const formatCountdown = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };
  const formatCoordinate = (c: [number, number] | null) =>
    c ? `${c[1].toFixed(5)}, ${c[0].toFixed(5)}` : 'Not available';
  const formatPermission = (s: Location.PermissionStatus) =>
    s === Location.PermissionStatus.GRANTED ? 'Granted' : s === Location.PermissionStatus.DENIED ? 'Denied' : 'Not requested';
  const getShiftDuration = () => {
    if (!activeShift?.started_at) return '0h 0m';
    const diff = Date.now() - new Date(activeShift.started_at).getTime();
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
  };

  if (!activeShift?.id) return null;

  const pollCountdown = isPolling && nextPollAt ? nextPollAt - now : null;
  const uploadCountdown = isPolling && nextUploadAt ? nextUploadAt - now : null;

  const statusRows: [string, string][] = [
    ['Tracking', isPolling ? 'Active' : 'Paused'],
    ['GPS permission', formatPermission(permissionStatus)],
    ['Last fix', lastFixTime ? lastFixTime.toLocaleTimeString() : 'Not available'],
    ['Next GPS check', pollCountdown !== null ? formatCountdown(pollCountdown) : 'Not scheduled'],
    ['Next upload', uploadCountdown !== null ? formatCountdown(uploadCountdown) : 'Pending first heartbeat'],
    ['Last coordinates', formatCoordinate(driverCoordinate)],
    ['Heading', driverHeading !== null ? `${driverHeading.toFixed(0)}°` : 'Not available'],
    ['Fix status', hasLocationFix ? 'Fix acquired' : 'Waiting for fix'],
  ];

  return (
    <ScreenContainer>
      <NetworkStatusBanner />

      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <View style={styles.dot} />
          <View>
            <Text style={styles.bannerText}>ON SHIFT</Text>
            <Text style={{ color: '#fff', fontSize: 12 }}>{driver?.name ?? 'Driver'} • {finalVehicleLabel}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
          <Text style={{ color: '#fff' }}>Menu</Text>
        </TouchableOpacity>

        <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
            <SafeAreaView style={styles.menuPanel}>
              <Text style={styles.menuTitle}>Navigation</Text>
              {MENU_ITEMS.map(({ label, screen }) => (
                <TouchableOpacity key={screen} style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate(screen as any); }}>
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
        {[['Duration', getShiftDuration()], ['GPS', 'Active'], ['Sync', 'Just now']].map(([label, value]) => (
          <View key={label} style={styles.metricItem}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        {hasShiftVehicleConflict && (
          <View style={styles.conflictCard}>
            <Text style={styles.conflictTitle}>Shift data conflict</Text>
            <Text style={styles.conflictBody}>{shiftConflictMessage}</Text>
          </View>
        )}

        <InfoCard title="Location status">
          {statusRows.map(([label, value]) => (
            <View key={label} style={styles.statusRow}>
              <Text style={styles.statusLabel}>{label}</Text>
              <Text style={styles.statusValue}>{value}</Text>
            </View>
          ))}
          {!state.activeShiftId && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Tracking reason</Text>
              <Text style={styles.statusValue}>No active shift</Text>
            </View>
          )}
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
          {NAV_BUTTONS.map(([label, screen]) => (
            <Button key={screen} label={label} variant="ghost" onPress={() => navigation.navigate(screen as any)} />
          ))}
        </View>

        <View style={{ marginTop: 12 }}>
          <Button
            label={`Offline Queue${state.queuedEventsCount > 0 ? ` (${state.queuedEventsCount})` : ''}`}
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
  banner: { backgroundColor: '#C62828', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  bannerText: { color: '#fff', fontWeight: '700' },
  menuButton: { padding: 8 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuPanel: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 },
  menuTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  menuItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  menuItemClose: { borderBottomWidth: 0, marginTop: 8, alignItems: 'center' },
  menuItemText: { fontSize: 15, color: '#111827' },
  metricsRow: { backgroundColor: '#F2F2F2', padding: 12, flexDirection: 'row', justifyContent: 'space-between' },
  metricItem: { alignItems: 'center', flex: 1 },
  metricLabel: { color: '#9E9E9E', fontSize: 12 },
  metricValue: { fontWeight: '700', marginTop: 6 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statusLabel: { color: '#6B7280', fontSize: 12 },
  statusValue: { fontWeight: '600', fontSize: 12, color: '#111827', textAlign: 'right', flexShrink: 1 },
  buttonRow: { marginTop: 12, gap: 8 },
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  conflictCard: { marginBottom: 12, borderWidth: 1, borderColor: '#D32F2F', backgroundColor: '#FFEBEE', borderRadius: 10, padding: 10 },
  conflictTitle: { color: '#B71C1C', fontWeight: '700', marginBottom: 4 },
  conflictBody: { color: '#7F1D1D', fontSize: 12 },
});