import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { SPRING_SMOOTH, TIMING_MED, COLORS, SHADOWS } from '../lib/animations';

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoCard({ title, children }: InfoCardProps) {
  const translateY = useSharedValue(10);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, SPRING_SMOOTH);
    opacity.value = withTiming(1, TIMING_MED);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    ...SHADOWS.card,
  },
  title: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: {
    gap: 6,
  },
});
