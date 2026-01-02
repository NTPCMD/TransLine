import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const backgroundColor = variant === 'primary' ? '#C62828' : variant === 'secondary' ? '#EEEEEE' : 'transparent';
  const textColor = variant === 'primary' ? '#FFFFFF' : '#1F2937';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor, opacity: disabled ? 0.6 : 1, borderColor: variant === 'ghost' ? '#C62828' : 'transparent' },
        style,
      ]}
    >
      <Text style={[styles.label, { color: variant === 'ghost' ? '#C62828' : textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
  },
});
