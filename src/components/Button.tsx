import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SPRING_SNAPPY, TIMING_FAST, COLORS } from '../lib/animations';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.965, SPRING_SNAPPY);
    opacity.value = withTiming(0.88, TIMING_FAST);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_SNAPPY);
    opacity.value = withTiming(1, TIMING_FAST);
  };

  const backgroundColor =
    variant === 'primary' ? COLORS.accent :
    variant === 'secondary' ? '#EDEFF2' :
    'transparent';

  const textColor =
    variant === 'primary' ? '#FFFFFF' :
    variant === 'ghost' ? COLORS.accent :
    COLORS.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.button,
          { backgroundColor },
          variant === 'primary' && styles.primaryButton,
          variant === 'ghost' && styles.ghostButton,
          disabled && styles.disabled,
          animStyle,
          style,
        ]}
      >
        <Text style={[styles.label, { color: disabled ? COLORS.textMuted : textColor }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  ghostButton: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  disabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    fontWeight: '600',
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
});
