import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export function AppButton({ label, onPress, variant = 'primary', disabled = false }: AppButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        disabled && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'secondary' && styles.btnTextSecondary,
          variant === 'danger' && styles.btnTextDanger,
          disabled && styles.btnTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    backgroundColor: '#E0E0E0',
  },
  btnDanger: {
    backgroundColor: '#B71C1C',
  },
  btnDisabled: {
    backgroundColor: '#BDBDBD',
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnTextSecondary: {
    color: '#333',
  },
  btnTextDanger: {
    color: '#fff',
  },
  btnTextDisabled: {
    color: '#757575',
  },
});
