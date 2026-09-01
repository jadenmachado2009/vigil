import type { SessionWindow } from '@/types/rules';

/** Minutes since local midnight for an instant, in the given IANA timezone. */
export function minutesInTimezone(iso: string, timezone: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
  } catch {
    return null; // unknown timezone
  }
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  // Intl can render midnight as "24" in some ICU versions.
  return (hour % 24) * 60 + minute;
}

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Start is inclusive, end is exclusive. A window whose end is earlier than its
 * start crosses midnight (e.g. the Asian session, 22:00-02:00).
 * Returns null when the timestamp or window cannot be parsed - the caller must
 * surface that as INSUFFICIENT DATA rather than as a failed rule.
 */
export function isWithinSession(iso: string, window: SessionWindow): boolean | null {
  const now = minutesInTimezone(iso, window.timezone);
  const start = parseClock(window.start);
  const end = parseClock(window.end);
  if (now === null || start === null || end === null) return null;
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/**
 * Wall-clock time of an instant in a given zone, "HH:mm".
 * A session rule is judged in the session's timezone, so that is the number
 * worth showing - not the raw UTC timestamp the observer happened to supply.
 */
export function clockInTimezone(iso: string, timezone: string): string | null {
  const minutes = minutesInTimezone(iso, timezone);
  if (minutes === null) return null;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function ageInDays(asOf: string, now: string): number | null {
  const a = new Date(asOf).getTime();
  const b = new Date(now).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / 86_400_000;
}
