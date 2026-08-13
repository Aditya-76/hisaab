/**
 * Day/week keys in Asia/Kolkata. IST is a FIXED +05:30 offset with no DST and
 * no historical changes in the app's lifetime, so plain offset arithmetic is
 * correct and no timezone database is needed (docs/DECISIONS.md D-023).
 *
 * A "day" is the Asia/Kolkata calendar date of the event (UX E5); a week is
 * Mon–Sun (docs/TECH-DESIGN.md §6).
 */

const IST_OFFSET_MS = 19_800_000; // +05:30

function istParts(iso: string): Date {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new TypeError(`not a parseable ISO timestamp: ${iso}`);
  }
  // Shift so that reading UTC fields yields IST wall-clock fields.
  return new Date(ms + IST_OFFSET_MS);
}

function dayKeyOf(shifted: Date): string {
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Asia/Kolkata calendar date ("2026-08-13") of an ISO timestamp. */
export function istDayKey(iso: string): string {
  return dayKeyOf(istParts(iso));
}

/** Day key of the Monday starting the Asia/Kolkata week containing `iso`. */
export function istWeekKey(iso: string): string {
  const shifted = istParts(iso);
  const weekday = shifted.getUTCDay(); // 0 Sun … 6 Sat
  const daysSinceMonday = (weekday + 6) % 7;
  shifted.setUTCDate(shifted.getUTCDate() - daysSinceMonday);
  return dayKeyOf(shifted);
}

/** All seven day keys (Mon–Sun) of the Asia/Kolkata week containing `iso`. */
export function istWeekDays(iso: string): string[] {
  const monday = istWeekKey(iso);
  const base = new Date(`${monday}T00:00:00.000Z`);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    days.push(dayKeyOf(d));
  }
  return days;
}
