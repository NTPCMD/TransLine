import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import ScreenContainer from '../components/ScreenContainer';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function ActiveShiftScreen({ navigation }: ScreenProps<'ActiveShift'>) {
  const { state } = useAppState();
  const [now, setNow] = useState(Date.now());
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
          <Text style={styles.bannerText}>ON SHIFT</Text>
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
        <View style={styles.mapPlaceholder}>
          <Text style={{ color: '#9E9E9E' }}>Map View Placeholder</Text>
        </View>

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
  mapPlaceholder: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
});
