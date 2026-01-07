import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ScreenHeader } from '../components/ScreenHeader';
import { Clock, MapPin, RefreshCw, AlertTriangle, Coffee, Fuel, MessageSquare, FileText, Menu } from 'lucide-react';
import MapLibreGL from '@maplibre/maplibre-react-native';

interface ActiveShiftScreenProps {
  shiftStartTime: Date | null;
  onBreak: () => void;
  onFuelLog: () => void;
  onIncident: () => void;
  onSendNote: () => void;
  onEndShift: () => void;
  onShiftDetails: () => void;
  onMedicalAbsence: () => void;
  onAnnouncements: () => void;
  onOperationsAlerts: () => void;
  onComponents: () => void;
  onMaintenanceLog: () => void;
}

export function ActiveShiftScreen({
  shiftStartTime,
  onBreak,
  onFuelLog,
  onIncident,
  onSendNote,
  onEndShift,
  onShiftDetails,
  onMedicalAbsence,
  onAnnouncements,
  onOperationsAlerts,
  onComponents,
  onMaintenanceLog
}: ActiveShiftScreenProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);
  const cameraRef = useRef<MapLibreGL.Camera | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const currentZoomRef = useRef(16.5);
  const hasInitialFixRef = useRef(false);
  const [trackingActive, setTrackingActive] = useState(Boolean(shiftStartTime));
  const [hasLocationFix, setHasLocationFix] = useState(false);
  const [driverCoordinate, setDriverCoordinate] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTrackingActive(Boolean(shiftStartTime));
  }, [shiftStartTime]);

  useEffect(() => {
    if (!trackingActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, heading } = position.coords;
        setHasLocationFix(true);

        const lngLat: [number, number] = [longitude, latitude];
        setDriverCoordinate(lngLat);

        if (typeof heading === 'number' && !Number.isNaN(heading)) {
          setDriverHeading(heading);
        }

        if (!hasInitialFixRef.current) {
          hasInitialFixRef.current = true;
          cameraRef.current?.setCamera({
            centerCoordinate: lngLat,
            zoomLevel: currentZoomRef.current,
            animationDuration: 0
          });
        } else {
          cameraRef.current?.setCamera({
            centerCoordinate: lngLat,
            zoomLevel: currentZoomRef.current,
            animationDuration: 800
          });
        }
      },
      error => {
        console.warn('Location error', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [trackingActive]);

  const handleRecenter = () => {
    if (!driverCoordinate) return;
    cameraRef.current?.setCamera({
      centerCoordinate: driverCoordinate,
      zoomLevel: currentZoomRef.current,
      animationDuration: 600
    });
  };

  const handleRegionDidChange = (event: any) => {
    const zoomLevel = event?.properties?.zoomLevel;
    if (typeof zoomLevel === 'number') {
      currentZoomRef.current = zoomLevel;
    }
  };

  const getShiftDuration = () => {
    if (!shiftStartTime) return '0h 0m';
    const diff = currentTime.getTime() - shiftStartTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      <div className="bg-[#C62828] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
            <span>ON SHIFT</span>
          </div>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} className="text-white">
          <Menu size={24} />
        </button>
      </div>

      {showMenu && (
        <div className="absolute top-16 right-4 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] rounded-[12px] z-50 overflow-hidden">
          <button
            onClick={() => {
              setShowMenu(false);
              onAnnouncements();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Announcements
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onMaintenanceLog();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Vehicle Maintenance Log
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onMedicalAbsence();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Medical Absence
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onOperationsAlerts();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors border-b border-[#F2F2F2]"
          >
            Operations Alerts
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onComponents();
            }}
            className="w-full px-6 py-3 text-left hover:bg-[#F2F2F2] transition-colors"
          >
            Components Library
          </button>
        </div>
      )}

      <div className="p-4 bg-[#F2F2F2] border-b border-[#9E9E9E]">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-[#9E9E9E] text-sm mb-1">
              <Clock size={16} />
              <span>Duration</span>
            </div>
            <p>{getShiftDuration()}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-[#9E9E9E] text-sm mb-1">
              <MapPin size={16} />
              <span>GPS</span>
            </div>
            <p className="flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Active
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-[#9E9E9E] text-sm mb-1">
              <RefreshCw size={16} />
              <span>Sync</span>
            </div>
            <p className="text-sm">Just now</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <div className="relative bg-[#F2F2F2] rounded-[12px] h-[55vh] min-h-[320px] overflow-hidden">
          <div className="absolute inset-0">
            <MapLibreGL.MapView
              style={{ flex: 1 }}
              onRegionDidChange={handleRegionDidChange}
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
                centerCoordinate={driverCoordinate ?? [151.2093, -33.8688]}
                heading={driverHeading ?? 0}
              />
              {driverCoordinate ? (
                <MapLibreGL.PointAnnotation id="driver-location" coordinate={driverCoordinate}>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: '#3B82F6',
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      shadowColor: '#3B82F6',
                      shadowOpacity: 0.8,
                      shadowRadius: 6
                    }}
                  />
                </MapLibreGL.PointAnnotation>
              ) : null}
            </MapLibreGL.MapView>
          </div>
          <div className="absolute top-3 left-3 bg-white/90 text-xs px-3 py-1 rounded-full shadow">
            {trackingActive ? 'Tracking active' : 'Tracking paused'}
          </div>
          <div className="absolute bottom-3 left-3 bg-white/90 text-xs px-3 py-1 rounded-full shadow">
            {hasLocationFix ? 'Live GPS lock' : 'Waiting for GPS fix'}
          </div>
          <button
            type="button"
            onClick={handleRecenter}
            className="absolute bottom-3 right-3 bg-[#0D47A1] text-white text-xs px-3 py-2 rounded-full shadow hover:bg-[#0B3C8C] transition-colors"
          >
            Recenter
          </button>
        </div>

        <Button
          variant="primary"
          fullWidth
          onClick={onIncident}
        >
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle size={20} />
            Something Gone Wrong
          </div>
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onBreak}>
            <div className="flex items-center justify-center gap-2">
              <Coffee size={20} />
              Break
            </div>
          </Button>
          <Button variant="outline" onClick={onFuelLog}>
            <div className="flex items-center justify-center gap-2">
              <Fuel size={20} />
              Fuel Log
            </div>
          </Button>
          <Button variant="outline" onClick={onSendNote}>
            <div className="flex items-center justify-center gap-2">
              <MessageSquare size={20} />
              Send Note
            </div>
          </Button>
          <Button variant="outline" onClick={onShiftDetails}>
            <div className="flex items-center justify-center gap-2">
              <FileText size={20} />
              Shift Details
            </div>
          </Button>
        </div>

        <div className="mt-auto">
          <Button variant="secondary" fullWidth onClick={onEndShift}>
            Log Off
          </Button>
        </div>
      </div>
    </div>
  );
}
