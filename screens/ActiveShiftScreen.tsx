import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ScreenHeader } from '../components/ScreenHeader';
import { Clock, MapPin, RefreshCw, AlertTriangle, Coffee, Fuel, MessageSquare, FileText, Menu } from 'lucide-react';

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
  const watchIdRef = useRef<number | null>(null);
  const [trackingActive, setTrackingActive] = useState(Boolean(shiftStartTime));
  const [hasLocationFix, setHasLocationFix] = useState(false);
  const [driverCoordinate, setDriverCoordinate] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState<number | null>(null);
  const [lastFixTime, setLastFixTime] = useState<Date | null>(null);
  const [permissionStatus, setPermissionStatus] = useState('Unknown');

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
        setLastFixTime(new Date(position.timestamp));

        const lngLat: [number, number] = [longitude, latitude];
        setDriverCoordinate(lngLat);

        if (typeof heading === 'number' && !Number.isNaN(heading)) {
          setDriverHeading(heading);
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

  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(result => setPermissionStatus(result.state))
      .catch(() => setPermissionStatus('Unknown'));
  }, []);

  const handleRefreshLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, heading } = position.coords;
        setHasLocationFix(true);
        setLastFixTime(new Date(position.timestamp));
        setDriverCoordinate([longitude, latitude]);
        if (typeof heading === 'number' && !Number.isNaN(heading)) {
          setDriverHeading(heading);
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
  };

  const formatCoordinate = () => {
    if (!driverCoordinate) return 'Not available';
    return `${driverCoordinate[1].toFixed(5)}, ${driverCoordinate[0].toFixed(5)}`;
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
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <p className="font-semibold mb-3">Location status</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[#6B7280]">
              <span>Tracking</span>
              <span className="font-medium text-[#111827]">{trackingActive ? 'Active' : 'Paused'}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>GPS permission</span>
              <span className="font-medium text-[#111827]">{permissionStatus}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Last fix</span>
              <span className="font-medium text-[#111827]">{lastFixTime ? lastFixTime.toLocaleTimeString() : 'Not available'}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Last coordinates</span>
              <span className="font-medium text-[#111827]">{formatCoordinate()}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Heading</span>
              <span className="font-medium text-[#111827]">{driverHeading !== null ? `${driverHeading.toFixed(0)}°` : 'Not available'}</span>
            </div>
            <div className="flex justify-between text-[#6B7280]">
              <span>Fix status</span>
              <span className="font-medium text-[#111827]">{hasLocationFix ? 'Fix acquired' : 'Waiting for fix'}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigator.geolocation?.getCurrentPosition(() => {}, () => {})}
              className="w-full border border-[#C62828] text-[#C62828] text-sm px-3 py-2 rounded-full"
            >
              Request GPS Permissions
            </button>
            <button
              type="button"
              onClick={handleRefreshLocation}
              className="w-full bg-[#0D47A1] text-white text-sm px-3 py-2 rounded-full shadow hover:bg-[#0B3C8C] transition-colors"
            >
              Refresh Location
            </button>
          </div>
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
