import * as Location from 'expo-location';
import { supabase } from './supabase';

export interface LocationLog {
  shift_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

class LocationTracker {
  private watchSubscription: Location.LocationSubscription | null = null;
  private currentShiftId: string | null = null;
  private updateInterval: number = 30000; // 30 seconds in milliseconds
  private lastUpdateTime: number = 0;

  /**
   * Start tracking location for a shift
   */
  async startTracking(shiftId: string): Promise<void> {
    if (this.watchSubscription) {
      console.warn('Location tracking already active');
      return;
    }

    // Request foreground permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return;
    }

    this.currentShiftId = shiftId;
    this.lastUpdateTime = 0;

    // Start watching position with specified criteria
    this.watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: this.updateInterval,
        distanceInterval: 100, // 100 meters
      },
      (location) => {
        this.handleLocationUpdate(location);
      }
    );

    console.log('Location tracking started for shift:', shiftId);
  }

  /**
   * Stop tracking when shift ends
   */
  stopTracking(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      this.currentShiftId = null;
      console.log('Location tracking stopped');
    }
  }

  /**
   * Get current location once
   */
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }

  /**
   * Update tracking interval (in seconds)
   */
  setUpdateInterval(seconds: number): void {
    this.updateInterval = seconds * 1000;
  }

  /**
   * Handle location update and save to database
   */
  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    if (!this.currentShiftId) {
      return;
    }

    // Throttle updates based on time interval
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateInterval) {
      return;
    }

    this.lastUpdateTime = now;

    const locationLog: LocationLog = {
      shift_id: this.currentShiftId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? null,
      speed: location.coords.speed ?? null,
      heading: location.coords.heading ?? null,
      timestamp: new Date(location.timestamp).toISOString(),
    };

    try {
      const { error } = await supabase.from('location_logs').insert(locationLog);
      if (error) {
        console.error('Failed to save location log:', error.message);
      } else {
        console.log('Location logged successfully');
      }
    } catch (error) {
      console.error('Exception while saving location log:', error);
    }
  }
}

// Export singleton instance
export const locationTracker = new LocationTracker();
