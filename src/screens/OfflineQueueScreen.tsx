import React, { useEffect, useState } from 'react';
import { formatPerthTime } from '../lib/formatPerthDateTime';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { offlineQueue, QueuedEvent } from '../lib/offlineQueue';
import { networkMonitor } from '../lib/networkMonitor';
import { AppButton } from '../components/AppButton';

export default function OfflineQueueScreen() {
  const navigation = useNavigation();
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to queue changes
    const unsubscribeQueue = offlineQueue.subscribe((newQueue) => {
      setQueue(newQueue);
      setLastSyncError(offlineQueue.getLastSyncError());
    });

    // Subscribe to network changes
    const unsubscribeNetwork = networkMonitor.subscribe((online) => {
      setIsOnline(online);
    });

    // Keep in sync with persisted queue state.
    const interval = setInterval(() => {
      setQueue(offlineQueue.getQueue());
      setLastSyncError(offlineQueue.getLastSyncError());
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
      await offlineQueue.retryNow();
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

  const formatTime = formatPerthTime;

  const renderEventItem = ({ item }: { item: QueuedEvent }) => (
    <View style={styles.eventRow}>
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventType}>{item.payload.event_type}</Text>
        </View>
        <View style={styles.eventFooter}>
          <Text style={styles.eventTime}>{formatTime(item.created_at)}</Text>
          {item.retry_count > 0 && (
            <Text style={styles.retryCount}>Retries: {item.retry_count}</Text>
          )}
        </View>
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>Payload</Text>
          <Text style={styles.detailText}>{JSON.stringify(item.payload)}</Text>
        </View>
        {!!item.last_error && (
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Last Error</Text>
            <Text style={styles.errorText}>{item.last_error}</Text>
          </View>
        )}
      </View>
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

  const renderHeader = () => (
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
      {lastSyncError ? <Text style={styles.lastErrorText}>Last sync error: {lastSyncError}</Text> : null}
    </View>
  );

  const renderFooter = () => (
    <View style={styles.buttonContainer}>
      <View style={styles.buttonRow}>
        <AppButton
          label={isSyncing ? 'Retrying...' : 'Retry sync now'}
          onPress={handleSyncNow}
          disabled={isSyncing || queue.length === 0}
          variant="primary"
        />
      </View>
      <View style={styles.buttonRow}>
        <AppButton
          label="Clear Queue"
          onPress={handleClearQueue}
          disabled={queue.length === 0}
          variant="danger"
        />
      </View>
      <View style={styles.buttonRow}>
        <AppButton
          label="Back"
          onPress={() => navigation.goBack()}
          variant="secondary"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={queue}
        renderItem={renderEventItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007bff"
          />
        }
        contentContainerStyle={queue.length === 0 ? styles.emptyListContent : styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  lastErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  emptyListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  eventRow: {
    width: '100%',
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
    width: '100%',
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
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    flex: 1,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    gap: 12,
    width: '100%',
  },
  buttonRow: {
    width: '100%',
  },
});
