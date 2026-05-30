import { summarizeBreakAllowance, MAX_BREAK_ALLOWANCE_SECONDS } from './breakAllowance';

const BASE = Date.parse('2026-01-01T00:00:00.000Z');

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${String(expected)} actual=${String(actual)}`);
  }
}

export function runBreakAllowanceTests() {
  // 10m + 15m = allowed
  const allowed = summarizeBreakAllowance(
    [
      { event_type: 'break_start', created_at: iso(BASE) },
      { event_type: 'break_end', created_at: iso(BASE + 10 * 60 * 1000) },
      { event_type: 'break_start', created_at: iso(BASE + 20 * 60 * 1000) },
      { event_type: 'break_end', created_at: iso(BASE + 35 * 60 * 1000) },
    ],
    BASE + 35 * 60 * 1000
  );
  expectEqual(allowed.totalSeconds, 25 * 60, '10m + 15m total');
  expectEqual(allowed.portalStatus, 'Within allowance', '25m within allowance');

  // 10m + 15m + 5m = exactly used
  const exactlyUsed = summarizeBreakAllowance(
    [
      { event_type: 'break_start', created_at: iso(BASE) },
      { event_type: 'break_end', created_at: iso(BASE + 10 * 60 * 1000) },
      { event_type: 'break_start', created_at: iso(BASE + 20 * 60 * 1000) },
      { event_type: 'break_end', created_at: iso(BASE + 35 * 60 * 1000) },
      { event_type: 'break_start', created_at: iso(BASE + 40 * 60 * 1000) },
      { event_type: 'break_end', created_at: iso(BASE + 45 * 60 * 1000) },
    ],
    BASE + 45 * 60 * 1000
  );
  expectEqual(exactlyUsed.totalSeconds, MAX_BREAK_ALLOWANCE_SECONDS, 'exactly 30m used');
  expectEqual(exactlyUsed.isUsedUp, true, 'exactly 30m marks used up');
  expectEqual(exactlyUsed.isExceeded, false, 'exactly 30m not exceeded');

  // 30m used then start break = blocked (represented by no remaining allowance)
  expectEqual(exactlyUsed.remainingSeconds, 0, 'no remaining allowance after 30m');

  // 31m total = flagged exceeded
  const exceeded = summarizeBreakAllowance(
    [
      { event_type: 'break_start', created_at: iso(BASE) },
      { event_type: 'break_end', created_at: iso(BASE + 31 * 60 * 1000) },
    ],
    BASE + 31 * 60 * 1000
  );
  expectEqual(exceeded.totalSeconds, 31 * 60, '31m total computed');
  expectEqual(exceeded.portalStatus, 'Exceeded allowance', '31m flagged exceeded');
  expectEqual(exceeded.exceededBySeconds, 60, '31m exceeded by 60s');
}

// Keep compile-safe and available for manual invocation.
export const breakAllowanceTestsDefined = true;
