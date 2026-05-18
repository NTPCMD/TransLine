import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { SPRING_SMOOTH, TIMING_MED, COLORS } from '../lib/animations';

export type ChipStatus = 'active' | 'idle' | 'break' | 'warning' | 'error' | 'success' | 'loading';

interface StatusChipProps {
  label: string;
  status: ChipStatus;
}

const STATUS_COLORS: Record<ChipStatus, { bg: string; text: string; dot: string }> = {
  active: { bg: '#DCFCE7', text: '#15803D', dot: '#16A34A' },
  idle:   { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  break:  { bg: '#FEF3C7', text: '#B45309', dot: '#D97706' },
  warning:{ bg: '#FEF3C7', text: '#B45309', dot: '#D97706' },
  error:  { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' },
  success:{ bg: '#DCFCE7', text: '#15803D', dot: '#16A34A' },
  loading:{ bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
};

const PULSING_STATES: ChipStatus[] = ['active', 'loading', 'break'];

export default function StatusChip({ label, status }: StatusChipProps) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const shouldPulse = PULSING_STATES.includes(status);

  const dotScale = useSharedValue(1);
  const dotOpacity = useSharedValue(1);
  const chipOpacity = useSharedValue(0);
  const chipScale = useSharedValue(0.88);

  useEffect(() => {
    // Entrance animation
    chipOpacity.value = withTiming(1, TIMING_MED);
    chipScale.value = withSpring(1, SPRING_SMOOTH);

    // Pulsing dot for active states
    if (shouldPulse) {
      dotScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 700 }),
          withTiming(1, { duration: 700 }),
        ),
        -1,
        false,
      );
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 700 }),
          withTiming(1, { duration: 700 }),
        ),
        -1,
        false,
      );
    }
  }, [status]);

  const chipAnimStyle = useAnimatedStyle(() => ({
    opacity: chipOpacity.value,
    transform: [{ scale: chipScale.value }],
  }));

  const dotAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotOpacity.value,
  }));

  return (
    <Animated.View style={[styles.chip, { backgroundColor: colors.bg }, chipAnimStyle]}>
      <Animated.View style={[styles.dot, { backgroundColor: colors.dot }, dotAnimStyle]} />
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
