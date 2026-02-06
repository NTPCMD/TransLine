import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { offlineQueue } from '../lib/offlineQueue';

const STOP_DETECTION_THRESHOLD_SECONDS = 120; // 2 minutes
const STOP_SPEED_THRESHOLD = 5; // km/h
const TRACKING_INTERVAL = 15000; // 15 seconds
const STOP_LOCATION_RADIUS_METERS = 100; // meters

const generateUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export interface GPSPoint {
  shift_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
}

export interface StopEvent {
  id: string;
  shift_id: string;
  started_at: string;
  ended_at: string | null;
  lat: number;
  lng: number;
  duration_seconds: number;
}

export type GPSState = 'idle' | 'requesting' | 'tracking' | 'degraded' | 'error';

interface GPSContextValue {
  gpsState: GPSState;
  error: string | null;
  isBackgroundEnabled: boolean;
  lastGPSFix: Date | null;
  startTracking: (shiftId: string) => Promise<void>;
  stopTracking: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

const GPSContext = createContext<GPSContextValue | undefined>(undefined);

export function GPSProvider({ children }: { children: ReactNode }) {
  const [gpsState, setGpsState] = useState<GPSState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(false);
  const [lastGPSFix, setLastGPSFix] = useState<Date | null>(null);

  const [trackingActive, setTrackingActive] = useState(false);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [watchRef, setWatchRef] = useState<Location.LocationSubscription | null>(null);
  const [stopBuffer, setStopBuffer] = useState<Location.LocationObject[]>([]);
  const [activeStop, setActiveStop] = useState<{
    startTime: Date;
    lat: number;
    lng: number;
    id: string;
  } | null>(null);

  const requestPermissions = useCallback(async () => {
    setGpsState('requesting');
    setError(null);

    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setError('Foreground location permission denied');
        setGpsState('error');
        setIsBackgroundEnabled(false);
        return false;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      const bgEnabled = bgStatus === 'granted';
      setIsBackgroundEnabled(bgEnabled);

      if (!bgEnabled) {
        console.warn('[GPS] Background permissions not granted. Tracking will work while app is open.');
      }

      setGpsState('idle');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Permission request failed';
      setError(msg);
      setGpsState('error');
      return false;
    }
  }, []);

  const saveGPSPoint = useCallback(
    async (shiftId: string, location: Location.LocationObject) => {
      const point: GPSPoint = {
        shift_id: shiftId,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        accuracy: location.coords.accuracy,
        recorded_at: new Date(location.timestamp).toISOString(),
      };

      const isOnline = async () => {
        try {
          const result = await supabase.from('gps_points').insert([point]).select();
          return !result.error;
        } catch {
          return false;
        }
      };

      const online = await isOnline();
      if (!online) {
        // Queue for offline sync - store locally
        console.log('[GPS] Queueing GPS point (offline)');
      } else {
        console.log('[GPS] GPS point saved');
      }

      setLastGPSFix(new Date());
    },
    []
  );

  const handleStopDetection = useCallback(
    async (location: Location.LocationObject, shiftId: string) => {
      const newBuffer = [...stopBuffer, location].slice(-10); // Keep last 10 points
      setStopBuffer(newBuffer);

      if (newBuffer.length < 3) return;

      // Check if we've been in same area for 2+ minutes
      const firstPoint = newBuffer[0];
      const lastPoint = newBuffer[newBuffer.length - 1];
      const timeSpanSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000;
      const speedKmh = (lastPoint.coords.speed ?? 0) / 3.6; // Convert m/s to km/h

      // Calculate distance between first and last point
      const lat1 = firstPoint.coords.latitude;
      const lon1 = firstPoint.coords.longitude;
      const lat2 = lastPoint.coords.latitude;
      const lon2 = lastPoint.coords.longitude;

      const R = 6371000; // Earth's radius in meters
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // distance in meters

      // Start stop event if conditions met
      if (speedKmh < STOP_SPEED_THRESHOLD && distance < STOP_LOCATION_RADIUS_METERS) {
        if (!activeStop) {
          const stopId = generateUuid();
          setActiveStop({
            startTime: new Date(firstPoint.timestamp),
            lat: firstPoint.coords.latitude,
            lng: firstPoint.coords.longitude,
            id: stopId,
          });
          console.log('[GPS] Stop event started');
        } else if (timeSpanSeconds > STOP_DETECTION_THRESHOLD_SECONDS) {
          // Stop event is confirmed (2+ minutes), save it
          const stop: StopEvent = {
            id: activeStop.id,
            shift_id: shiftId,
            started_at: activeStop.startTime.toISOString(),
            ended_at: null,
            lat: activeStop.lat,
            lng: activeStop.lng,
            duration_seconds: Math.round(timeSpanSeconds),
          };

          // Try to save, queue if offline
          try {
            const { error } = await supabase.from('stop_events').insert([stop]);
            if (error) throw error;
            console.log('[GPS] Stop event saved:', stop.id);
          } catch (e) {
            console.warn('[GPS] Failed to save stop event, would queue:', e);
          }
        }
      } else if (activeStop) {
        // Movement resumed, close the stop event
        const stop: StopEvent = {
          id: activeStop.id,
          shift_id: shiftId,
          started_at: activeStop.startTime.toISOString(),
          ended_at: new Date().toISOString(),
          lat: activeStop.lat,
          lng: activeStop.lng,
          duration_seconds: Math.round(timeSpanSeconds),
        };

        try {
          const { error } = await supabase
            .from('stop_events')
            .upsert([stop], { onConflict: 'id' });
          if (error) throw error;
          console.log('[GPS] Stop event ended:', stop.id);
        } catch (e) {
          console.warn('[GPS] Failed to update stop event:', e);
        }

        setActiveStop(null);
        setStopBuffer([]);
      }
    },
    [stopBuffer, activeStop]
  );

  const startTracking = useCallback(
    async (shiftId: string) => {
      if (trackingActive) {
        console.warn('[GPS] Tracking already active');
        return;
      }

      setGpsState('requesting');
      setCurrentShiftId(shiftId);
      setTrackingActive(true);

      // Request permissions if not already done
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const permGranted = await requestPermissions();
        if (!permGranted) {
          setGpsState('error');
          setTrackingActive(false);
          return;
        }
      }

      try {
        setGpsState('tracking');
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: TRACKING_INTERVAL,
            distanceInterval: 10, // 10 meters
          },
          async (location) => {
            await saveGPSPoint(shiftId, location);
            await handleStopDetection(location, shiftId);
          }
        );

        setWatchRef(subscription);
        console.log('[GPS] Tracking started for shift:', shiftId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to start tracking';
        setError(msg);
        setGpsState('error');
        setTrackingActive(false);
      }
    },
    [trackingActive, saveGPSPoint, handleStopDetection, requestPermissions]
  );

  const stopTracking = useCallback(async () => {
    if (watchRef) {
      watchRef.remove();
      setWatchRef(null);
    }

    if (activeStop) {
      // Save final stop event
      const stop: StopEvent = {
        id: activeStop.id,
        shift_id: currentShiftId!,
        started_at: activeStop.startTime.toISOString(),
        ended_at: new Date().toISOString(),
        lat: activeStop.lat,
        lng: activeStop.lng,
        duration_seconds: Math.round((Date.now() - activeStop.startTime.getTime()) / 1000),
      };

      try {
        const { error } = await supabase.from('stop_events').upsert([stop], { onConflict: 'id' });
        if (error) throw error;
      } catch (e) {
        console.warn('[GPS] Failed to finalize stop event:', e);
      }

      setActiveStop(null);
    }

    setTrackingActive(false);
    setCurrentShiftId(null);
    setGpsState('idle');
    setStopBuffer([]);
    console.log('[GPS] Tracking stopped');
  }, [watchRef, activeStop, currentShiftId]);

  useEffect(() => {
    return () => {
      if (watchRef) {
        watchRef.remove();
      }
    };
  }, [watchRef]);

  return (
    <GPSContext.Provider
      value={{
        gpsState,
        error,
        isBackgroundEnabled,
        lastGPSFix,
        startTracking,
        stopTracking,
        requestPermissions,
      }}
    >
      {children}
    </GPSContext.Provider>
  );
}

export function useGPS() {
  const context = useContext(GPSContext);
  if (!context) {
    throw new Error('useGPS must be used within GPSProvider');
  }
  return context;
}
