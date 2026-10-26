// All dates in the app are plain "YYYY-MM-DD" strings for the user's logical day.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The logical day: entries made before the cutoff hour (e.g. 1:30 AM with a
// 4 AM cutoff) belong to the previous calendar day.
export function logicalToday(timezone: string, cutoffHour: number, now = new Date()): string {
  const shifted = new Date(now.getTime() - cutoffHour * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[toUtc(iso).getUTCDay()];
}

// "Mon, 26 Oct 2026"
export function formatDay(iso: string): string {
  const d = toUtc(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value).getTime());
}

// Consecutive logged days ending today, or yesterday if today isn't logged yet.
export function currentStreak(loggedDays: Set<string>, today: string): number {
  let day = loggedDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (loggedDays.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
