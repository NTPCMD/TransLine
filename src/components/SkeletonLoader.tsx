import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../lib/animations';

interface SkeletonLineProps {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}

function SkeletonLine({ width = '100%', height = 14, style }: SkeletonLineProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 650 }),
        withTiming(0.35, { duration: 650 }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.line,
        { width: width as any, height },
        animStyle,
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  style?: ViewStyle;
}

function SkeletonCard({ lines = 2, style }: SkeletonCardProps) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonLine width="45%" height={11} style={{ marginBottom: 4 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={16}
        />
      ))}
    </View>
  );
}

const SkeletonLoader = { Line: SkeletonLine, Card: SkeletonCard };
export default SkeletonLoader;

const styles = StyleSheet.create({
  line: {
    backgroundColor: '#D1D5DB',
    borderRadius: 6,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
});
