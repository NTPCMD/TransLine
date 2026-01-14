import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { networkMonitor } from '../lib/networkMonitor';
import { offlineQueue } from '../lib/offlineQueue';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribeNetwork = networkMonitor.subscribe((online) => {
      setIsOnline(online);
    });

    // Subscribe to queue changes
    const unsubscribeQueue = offlineQueue.subscribe((queue) => {
      setQueuedCount(queue.length);
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeQueue();
    };
  }, []);

  // Don't show banner when online and queue is empty
  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <View style={[
      styles.banner,
      !isOnline ? styles.offlineBanner : styles.queuedBanner
    ]}>
      <Text style={styles.bannerText}>
        {!isOnline 
          ? '🔴 Offline - Events will sync when connected'
          : `🟡 ${queuedCount} event${queuedCount !== 1 ? 's' : ''} waiting to sync`
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
  },
});
