import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { offlineQueue, QueuedEvent } from '../lib/offlineQueue';
import { networkMonitor } from '../lib/networkMonitor';
import ScreenContainer from '../components/ScreenContainer';
import { AppButton } from '../components/AppButton';

export default function OfflineQueueScreen() {
  const navigation = useNavigation();
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Subscribe to queue changes
    const unsubscribeQueue = offlineQueue.subscribe((newQueue) => {
      setQueue(newQueue);
    });

    // Subscribe to network changes
    const unsubscribeNetwork = networkMonitor.subscribe((online) => {
      setIsOnline(online);
    });

    // Auto-refresh every 2 seconds to show status updates
    const interval = setInterval(() => {
      setQueue(offlineQueue.getQueue());
    }, 2000);

    return () => {
      unsubscribeQueue();
      unsubscribeNetwork();
      clearInterval(interval);
    };
  }, []);

  const handleSyncNow = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please connect to the internet.');
      return;
    }

    setIsSyncing(true);
    try {
      await offlineQueue.syncQueue();
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', 'Failed to sync events. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await handleSyncNow();
    setIsRefreshing(false);
  };

  const handleClearQueue = () => {
    Alert.alert(
      'Clear Queue',
      'Are you sure you want to clear all queued events? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await offlineQueue.clearQueue();
          },
        },
      ]
    );
  };

  const getStatusColor = (status: QueuedEvent['status']) => {
    switch (status) {
      case 'pending':
        return '#ffc107'; // Yellow
      case 'syncing':
        return '#007bff'; // Blue
      case 'failed':
        return '#dc3545'; // Red
      default:
        return '#6c757d'; // Gray
    }
  };

  const getStatusIcon = (status: QueuedEvent['status']) => {
    switch (status) {
      case 'pending':
        return '🟡';
      case 'syncing':
        return '🔵';
      case 'failed':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderEventItem = ({ item }: { item: QueuedEvent }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventType}>{item.eventType}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>
            {getStatusIcon(item.status)} {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.eventFooter}>
        <Text style={styles.eventTime}>{formatTime(item.timestamp)}</Text>
        {item.retryCount > 0 && (
          <Text style={styles.retryCount}>Retries: {item.retryCount}</Text>
        )}
      </View>
      {!!item.payload && (
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Payload</Text>
          <Text style={styles.detailText}>{JSON.stringify(item.payload)}</Text>
        </View>
      )}
      {!!item.lastError && (
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Last Error</Text>
          <Text style={styles.errorText}>{item.lastError}</Text>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No queued events</Text>
      <Text style={styles.emptyStateSubtext}>
        Events will appear here when you're offline or when sync fails
      </Text>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Offline Queue</Text>
          <Text style={styles.subtitle}>
            {queue.length} event{queue.length !== 1 ? 's' : ''} in queue
          </Text>
          {!isOnline && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>🔴 Currently Offline</Text>
            </View>
          )}
        </View>

        <FlatList
          data={queue}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#007bff"
            />
          }
          contentContainerStyle={queue.length === 0 ? styles.emptyListContent : styles.listContent}
        />

        <View style={styles.buttonContainer}>
          <AppButton
            label={isSyncing ? 'Syncing...' : 'Sync Now'}
            onPress={handleSyncNow}
            disabled={isSyncing || !isOnline || queue.length === 0}
            variant="primary"
          />
          <AppButton
            label="Clear Queue"
            onPress={handleClearQueue}
            disabled={queue.length === 0}
            variant="danger"
          />
          <AppButton
            label="Back"
            onPress={() => navigation.goBack()}
            variant="secondary"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  offlineIndicator: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#ffe5e5',
    borderRadius: 4,
  },
  offlineText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 14,
    color: '#6c757d',
  },
  retryCount: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: '600',
  },
  detailBox: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#111827',
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    gap: 12,
  },
});
