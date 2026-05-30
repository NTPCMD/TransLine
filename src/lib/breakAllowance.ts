export const MAX_BREAK_ALLOWANCE_SECONDS = 30 * 60;

export type BreakEventType = 'break_start' | 'break_end';

export type BreakEventRow = {
  event_type: BreakEventType;
  created_at: string;
};

export type BreakAllowanceSummary = {
  totalSeconds: number;
  remainingSeconds: number;
  currentSessionSeconds: number;
  isOnBreak: boolean;
  isUsedUp: boolean;
  isExceeded: boolean;
  exceededBySeconds: number;
  portalStatus: 'Within allowance' | 'Exceeded allowance';
  workingBreakDeductionSeconds: number;
};

export function summarizeBreakAllowance(events: BreakEventRow[], nowMs: number): BreakAllowanceSummary {
  let totalSeconds = 0;
  let activeBreakStartMs: number | null = null;

  for (const event of events) {
    const eventMs = new Date(event.created_at).getTime();
    if (!Number.isFinite(eventMs)) continue;

    if (event.event_type === 'break_start') {
      activeBreakStartMs = eventMs;
      continue;
    }

    if (event.event_type === 'break_end' && activeBreakStartMs !== null) {
      if (eventMs > activeBreakStartMs) {
        totalSeconds += Math.floor((eventMs - activeBreakStartMs) / 1000);
      }
      activeBreakStartMs = null;
    }
  }

  const currentSessionSeconds =
    activeBreakStartMs !== null && nowMs > activeBreakStartMs
      ? Math.floor((nowMs - activeBreakStartMs) / 1000)
      : 0;

  if (currentSessionSeconds > 0) {
    totalSeconds += currentSessionSeconds;
  }

  const remainingSeconds = Math.max(0, MAX_BREAK_ALLOWANCE_SECONDS - totalSeconds);
  const isUsedUp = totalSeconds >= MAX_BREAK_ALLOWANCE_SECONDS;
  const isExceeded = totalSeconds > MAX_BREAK_ALLOWANCE_SECONDS;
  const exceededBySeconds = Math.max(0, totalSeconds - MAX_BREAK_ALLOWANCE_SECONDS);

  return {
    totalSeconds,
    remainingSeconds,
    currentSessionSeconds,
    isOnBreak: activeBreakStartMs !== null,
    isUsedUp,
    isExceeded,
    exceededBySeconds,
    portalStatus: isExceeded ? 'Exceeded allowance' : 'Within allowance',
    workingBreakDeductionSeconds: Math.min(totalSeconds, MAX_BREAK_ALLOWANCE_SECONDS),
  };
}

export function buildBreakAllowanceMetadata(totalBreakSeconds: number) {
  const exceededBySeconds = Math.max(0, totalBreakSeconds - MAX_BREAK_ALLOWANCE_SECONDS);
  const isExceeded = totalBreakSeconds > MAX_BREAK_ALLOWANCE_SECONDS;
  const isUsedUp = totalBreakSeconds >= MAX_BREAK_ALLOWANCE_SECONDS;

  return {
    raw_break_seconds: totalBreakSeconds,
    allowed_break_seconds: MAX_BREAK_ALLOWANCE_SECONDS,
    break_allowance_status: isExceeded ? 'Exceeded allowance' : 'Within allowance',
    break_allowance_used_up: isUsedUp,
    break_allowance_exceeded: isExceeded,
    exceeded_by_seconds: exceededBySeconds,
    working_break_deduction_seconds: Math.min(totalBreakSeconds, MAX_BREAK_ALLOWANCE_SECONDS),
  };
}
