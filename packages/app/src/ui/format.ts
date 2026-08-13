/**
 * Display-only date/time helpers, Asia/Kolkata wall clock via the same
 * fixed +05:30 arithmetic as core/time.ts (D-023 — no timezone database,
 * no Intl dependency on low-end Hermes builds). Month/weekday names come
 * from the caller's locale strings; these functions return only numbers.
 */

const IST_OFFSET_MS = 19_800_000;

export interface IstClock {
  /** 1–12. */
  hour: number;
  /** Zero-padded "00"–"59". */
  minute: string;
  period: "am" | "pm";
}

/** IST wall-clock time of an ISO timestamp, for list rows ("7:42 pm"). */
export function istClock(iso: string): IstClock {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new TypeError(`not a parseable ISO timestamp: ${iso}`);
  const shifted = new Date(ms + IST_OFFSET_MS);
  const hour24 = shifted.getUTCHours();
  return {
    hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute: String(shifted.getUTCMinutes()).padStart(2, "0"),
    period: hour24 < 12 ? "am" : "pm",
  };
}

export interface DayParts {
  dayOfMonth: number;
  /** 0 = January. */
  monthIndex: number;
  /** 0 = Monday, matching the Mon–Sun week (TECH-DESIGN §6). */
  weekdayIndex: number;
}

/** Split a day key ("2026-08-13") for localized labels ("13 Aug"). */
export function dayParts(dayKey: string): DayParts {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new TypeError(`not a day key: ${dayKey}`);
  return {
    dayOfMonth: date.getUTCDate(),
    monthIndex: date.getUTCMonth(),
    weekdayIndex: (date.getUTCDay() + 6) % 7,
  };
}

/** Today's Asia/Kolkata day key for a given instant. */
export function istTodayKey(nowMs: number): string {
  const shifted = new Date(nowMs + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The day key immediately before `dayKey`. */
export function previousDayKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
