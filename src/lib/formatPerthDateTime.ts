/**
 * Formats a UTC ISO string (or Date) for display in Perth time (Australia/Perth, UTC+8).
 * Supabase timestamps are stored as UTC — only convert here for display.
 */

const PERTH_LOCALE = 'en-AU';
const PERTH_TZ = 'Australia/Perth';

/**
 * Returns a formatted date+time string in Perth time.
 * e.g. "07/05/2026, 10:30 AM"
 */
export function formatPerthDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString(PERTH_LOCALE, {
    timeZone: PERTH_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns only the date portion in Perth time.
 * e.g. "07/05/2026"
 */
export function formatPerthDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(PERTH_LOCALE, {
    timeZone: PERTH_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Returns only the time portion in Perth time.
 * e.g. "10:30 AM"
 */
export function formatPerthTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(PERTH_LOCALE, {
    timeZone: PERTH_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
