import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { networkMonitor } from '../lib/networkMonitor';
import { offlineQueue } from '../lib/offlineQueue';
import { SPRING_SMOOTH, TIMING_MED } from '../lib/animations';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  const isVisible = !isOnline || queuedCount > 0;

  useEffect(() => {
    if (isVisible) {
      translateY.value = withSpring(0, SPRING_SMOOTH);
      opacity.value = withTiming(1, TIMING_MED);
    } else {
      translateY.value = withSpring(-80, SPRING_SMOOTH);
      opacity.value = withTiming(0, TIMING_MED);
    }
  }, [isVisible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

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

  if (!isVisible && opacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.banner, !isOnline ? styles.offlineBanner : styles.queuedBanner, animStyle]}>
      <Text style={styles.bannerText}>
        {!isOnline ? 'Offline' : `${queuedCount} event${queuedCount !== 1 ? 's' : ''} pending sync`}
      </Text>
      {!isOnline ? <Text style={styles.subText}>Events will sync automatically when back online.</Text> : null}
      {lastError ? <Text style={styles.errorText}>Sync error: {lastError}</Text> : null}
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry} disabled={isRetrying}>
        <Text style={styles.retryText}>{isRetrying ? 'Retrying…' : 'Retry now'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  offlineBanner: {
    backgroundColor: '#DC2626',
  },
  queuedBanner: {
    backgroundColor: '#D97706',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  subText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  retryButton: {
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

