import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'transline:pushToken';
const NOTIFICATION_SETTINGS_KEY = 'transline:notificationSettings';

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
}

// Set notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class PushNotificationManager {
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Register device for push notifications
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Check if running on physical device
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, 'denied');
        return null;
      }

      // Get Expo push token
      // Note: projectId should match the 'extra.eas.projectId' in app.json
      // For now, we'll let Expo infer it from the app configuration
      const tokenData = await Notifications.getExpoPushTokenAsync();

      const token = tokenData.data;

      // Save token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

      // Setup notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#C62828',
        });
      }

      console.log('Push notification registered:', token);
      return token;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  /**
   * Save push token to Supabase
   */
  async savePushToken(driverId: string, token: string): Promise<void> {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      const { error } = await supabase
        .from('driver_push_tokens')
        .upsert(
          {
            driver_id: driverId,
            push_token: token,
            platform,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'driver_id,platform',
          }
        );

      if (error) {
        console.error('Failed to save push token:', error.message);
      } else {
        console.log('Push token saved successfully');
      }
    } catch (error) {
      console.error('Exception while saving push token:', error);
    }
  }

  /**
   * Send local notification
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data ?? {},
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  }

  /**
   * Setup notification listener for when notifications are received
   */
  setupNotificationListener(
    callback: (notification: Notifications.Notification) => void
  ): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }

    this.notificationListener = Notifications.addNotificationReceivedListener(
      callback
    );
  }

  /**
   * Setup notification response listener for when user taps a notification
   */
  setupNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): void {
    if (this.responseListener) {
      this.responseListener.remove();
    }

    this.responseListener =
      Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Remove notification listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Get notification settings from AsyncStorage
   */
  async getSettings(): Promise<NotificationSettings> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }

    // Default settings
    return {
      enabled: true,
      sound: true,
      vibration: true,
    };
  }

  /**
   * Save notification settings to AsyncStorage
   */
  async saveSettings(settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  /**
   * Get stored push token
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get stored push token:', error);
      return null;
    }
  }
}

// Export singleton instance
export const pushNotificationManager = new PushNotificationManager();
