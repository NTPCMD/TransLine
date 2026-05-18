import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

// ─── Spring configs ──────────────────────────────────────────────────────────
/** Fast, snappy spring — button press, micro-interactions */
export const SPRING_SNAPPY: WithSpringConfig = {
  damping: 20,
  stiffness: 400,
  mass: 0.8,
};

/** Smooth, natural spring — card entrance, modal open */
export const SPRING_SMOOTH: WithSpringConfig = {
  damping: 22,
  stiffness: 260,
  mass: 1,
};

/** Gentle spring — page / screen entrance */
export const SPRING_ENTER: WithSpringConfig = {
  damping: 26,
  stiffness: 200,
  mass: 1,
};

// ─── Timing configs ──────────────────────────────────────────────────────────
export const TIMING_FAST: WithTimingConfig = { duration: 120 };
export const TIMING_MED: WithTimingConfig = { duration: 220 };
export const TIMING_SLOW: WithTimingConfig = { duration: 360 };

// ─── Design tokens ───────────────────────────────────────────────────────────
export const COLORS = {
  background: '#F3F4F7',
  surface: '#FFFFFF',
  border: '#E8E9ED',
  borderSubtle: '#F0F1F4',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#C62828',
  accentLight: '#FEE2E2',
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#2563EB',
  infoLight: '#DBEAFE',
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  lifted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
