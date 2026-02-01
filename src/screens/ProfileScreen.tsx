import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import InfoCard from '../components/InfoCard';
import { useDriver } from '../state/DriverContext';
import { useAppState } from '../state/AppStateContext';
import { supabase } from '../lib/supabase';
import { pushNotificationManager } from '../lib/pushNotifications';
import type { ScreenProps } from '../types/navigation';

export default function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const { currentDriver, authUserId } = useDriver();
  const { state, updateAppState, resetShift } = useAppState();
  const [loading, setLoading] = useState(true);
  const [driverEmail, setDriverEmail] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [lastLogin, setLastLogin] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);
  
  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  useEffect(() => {
    loadDriverInfo();
    loadSettings();
    registerPushToken();
  }, [currentDriver, authUserId]);

  const registerPushToken = async () => {
    if (!currentDriver?.id) return;
    
    try {
      const storedToken = await pushNotificationManager.getStoredToken();
      if (storedToken && storedToken !== 'denied') {
        // Save token to database if we have one
        await pushNotificationManager.savePushToken(currentDriver.id, storedToken);
      }
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  };

  const loadDriverInfo = async () => {
    if (!authUserId) return;

    try {
      // Get email from auth user
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) {
        setDriverEmail(userData.user.email);
      }

      // Get additional info from drivers table
      if (currentDriver?.id) {
        const { data, error } = await supabase
          .from('drivers')
          .select('phone, last_login')
          .eq('id', currentDriver.id)
          .single();

        if (!error && data) {
          setDriverPhone(data.phone ?? '');
          setLastLogin(data.last_login ?? '');
        }
      }
    } catch (error) {
      console.error('Failed to load driver info:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await pushNotificationManager.getSettings();
      setNotificationsEnabled(settings.enabled);
      setSoundEnabled(settings.sound);
      setVibrationEnabled(settings.vibration);
      // Location setting is always enabled for now
      setLocationEnabled(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await pushNotificationManager.saveSettings({
      enabled: value,
      sound: soundEnabled,
      vibration: vibrationEnabled,
    });

    // If enabling, re-register for push notifications
    if (value && currentDriver?.id) {
      const token = await pushNotificationManager.registerForPushNotifications();
      if (token) {
        await pushNotificationManager.savePushToken(currentDriver.id, token);
      }
    }
  };

  const handleSoundToggle = async (value: boolean) => {
    setSoundEnabled(value);
    await pushNotificationManager.saveSettings({
      enabled: notificationsEnabled,
      sound: value,
      vibration: vibrationEnabled,
    });
  };

  const handleVibrationToggle = async (value: boolean) => {
    setVibrationEnabled(value);
    await pushNotificationManager.saveSettings({
      enabled: notificationsEnabled,
      sound: soundEnabled,
      vibration: value,
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to logout? Any unsaved data will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear app state
              resetShift();
              
              // Sign out from Supabase
              await supabase.auth.signOut();
              
              // Navigate to login
              navigation.replace('Login');
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleViewShiftHistory = () => {
    navigation.navigate('ShiftHistory');
  };

  const handleViewOfflineQueue = () => {
    navigation.navigate('OfflineQueue');
  };

  const formatLastLogin = (timestamp: string) => {
    if (!timestamp) return 'Never';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <ScreenContainer title="Profile" subtitle="Loading...">
        <Text style={styles.loadingText}>Loading profile...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Profile" subtitle="Manage your account">
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Driver Information */}
        <View style={styles.section}>
          <TouchableOpacity onLongPress={() => setShowDebug(prev => !prev)} activeOpacity={1}>
            <Text style={styles.sectionTitle}>Driver Information</Text>
          </TouchableOpacity>
          <InfoCard title="Details">
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{currentDriver?.name ?? 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{driverEmail || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{driverPhone || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Driver ID:</Text>
              <Text style={styles.infoValue}>{currentDriver?.id?.slice(0, 8) ?? 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={[styles.infoValue, styles.statusActive]}>Active</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Login:</Text>
              <Text style={styles.infoValue}>{formatLastLogin(lastLogin)}</Text>
            </View>
          </InfoCard>
          {showDebug ? (
            <InfoCard title="Debug panel">
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Auth UID:</Text>
                <Text style={styles.infoValue}>{authUserId ?? 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Driver ID:</Text>
                <Text style={styles.infoValue}>{state.driverRecordId ?? 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vehicle ID:</Text>
                <Text style={styles.infoValue}>{state.vehicleId ?? 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Assignment:</Text>
                <Text style={styles.infoValue}>{state.vehicleId ? 'active' : 'missing'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Shift ID:</Text>
                <Text style={styles.infoValue}>{state.activeShiftId ?? 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Checklist submitted:</Text>
                <Text style={styles.infoValue}>{state.checklistSubmitted ? 'Yes' : 'No'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Checklist passed:</Text>
                <Text style={styles.infoValue}>{state.checklistCompleted ? 'Yes' : 'No'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Start odometer:</Text>
                <Text style={styles.infoValue}>{state.odometerReading || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Start capture:</Text>
                <Text style={styles.infoValue}>{state.startOdometerCapturedAt ?? 'N/A'}</Text>
              </View>
            </InfoCard>
          ) : null}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
                thumbColor={notificationsEnabled ? '#C62828' : '#F3F4F6'}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Location Tracking</Text>
              <Switch
                value={locationEnabled}
                disabled={true}
                trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
                thumbColor={locationEnabled ? '#C62828' : '#F3F4F6'}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Sound Notifications</Text>
              <Switch
                value={soundEnabled}
                onValueChange={handleSoundToggle}
                trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
                thumbColor={soundEnabled ? '#C62828' : '#F3F4F6'}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Vibration</Text>
              <Switch
                value={vibrationEnabled}
                onValueChange={handleVibrationToggle}
                trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
                thumbColor={vibrationEnabled ? '#C62828' : '#F3F4F6'}
              />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Button
            label="View Shift History"
            variant="secondary"
            onPress={handleViewShiftHistory}
            style={styles.actionButton}
          />
          <Button
            label="View Offline Queue"
            variant="secondary"
            onPress={handleViewOfflineQueue}
            style={styles.actionButton}
          />
          <Button
            label="Help & Support"
            variant="secondary"
            onPress={() => Alert.alert('Help & Support', 'Contact support at support@transline.com')}
            style={styles.actionButton}
          />
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Button
            label="Logout"
            variant="ghost"
            onPress={handleLogout}
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  statusActive: {
    color: '#059669',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLabel: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    marginTop: 8,
  },
});
