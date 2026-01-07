import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import ScreenContainer from '../components/ScreenContainer';
import { useAppState } from '../state/AppStateContext';
import type { ScreenProps } from '../types/navigation';

export default function ActiveShiftScreen({ navigation }: ScreenProps<'ActiveShift'>) {
  const { state } = useAppState();
  const [now, setNow] = useState(Date.now());
  const [showMenu, setShowMenu] = useState(false);
  const cameraRef = useRef<MapLibreGL.Camera | null>(null);
  const currentZoomRef = useRef(14);

  useEffect(() => {
    console.log('[ActiveShiftScreen] MapLibre screen mounted');
  }, []);

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
        <View style={styles.mapContainer}>
          <MapLibreGL.MapView
            style={styles.map}
            styleURL={MapLibreGL.StyleURL.Empty}
          >
            <MapLibreGL.RasterSource
              id="osm-tiles"
              tileUrlTemplates={['https://tile.openstreetmap.org/{z}/{x}/{y}.png']}
              tileSize={256}
            >
              <MapLibreGL.RasterLayer id="osm-raster" sourceID="osm-tiles" />
            </MapLibreGL.RasterSource>
            <MapLibreGL.Camera
              ref={cameraRef}
              zoomLevel={currentZoomRef.current}
              centerCoordinate={[151.2093, -33.8688]}
            />
          </MapLibreGL.MapView>
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayText}>MAP RENDERED</Text>
          </View>
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
  mapContainer: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    height: 180,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mapOverlayText: {
    color: '#0D47A1',
    fontWeight: '700',
    fontSize: 12,
  },
  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
});
