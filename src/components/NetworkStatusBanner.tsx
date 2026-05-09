import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { networkMonitor } from '../lib/networkMonitor';
import { offlineQueue } from '../lib/offlineQueue';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const unsubscribeNetwork = networkMonitor.subscribe((online) => {
      setIsOnline(online);
    });

    const unsubscribeQueue = offlineQueue.subscribe((queue) => {
      setQueuedCount(queue.length);
      setLastError(offlineQueue.getLastSyncError());
    });

    setLastError(offlineQueue.getLastSyncError());

    return () => {
      unsubscribeNetwork();
      unsubscribeQueue();
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await offlineQueue.retryNow();
      setLastError(offlineQueue.getLastSyncError());
    } finally {
      setIsRetrying(false);
    }
  };

  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <View style={[
      styles.banner,
      !isOnline ? styles.offlineBanner : styles.queuedBanner,
    ]}>
      <Text style={styles.bannerText}>
        Pending sync count: {queuedCount}
      </Text>
      {!isOnline ? <Text style={styles.subText}>Offline - events will sync automatically when online.</Text> : null}
      {lastError ? <Text style={styles.errorText}>Last sync error: {lastError}</Text> : null}
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry} disabled={isRetrying}>
        <Text style={styles.retryText}>{isRetrying ? 'Retrying…' : 'Retry sync now'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
  },
  offlineBanner: {
    backgroundColor: '#dc3545',
  },
  queuedBanner: {
    backgroundColor: '#ffc107',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  subText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    color: '#ffffff',
    fontSize: 12,
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
