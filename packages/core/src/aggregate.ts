/**
 * Pure aggregation over already-fetched rows. In the app, SQL does the heavy
 * lifting (SUM/GROUP BY over precomputed day columns); these functions define
 * the semantics and serve the CLI/tests (docs/TECH-DESIGN.md §6).
 *
 * Net contribution of an earning = netPayout ?? grossAmount (gross already
 * includes tips/surge when the platform reports one total). Credited
 * incentives add; expenses subtract.
 */
import { istDayKey, istWeekDays, istWeekKey } from "./time.js";
import type { Earning, Expense, IncentiveEvent } from "./types/index.js";

export interface DaySummary {
  /** Asia/Kolkata calendar date, e.g. "2026-08-13". */
  day: string;
  netPaise: number;
  earningsPaise: number;
  incentivesPaise: number;
  expensesPaise: number;
  earningCount: number;
}

export interface PlatformSummary {
  platform: string;
  netPaise: number;
  earningsPaise: number;
  incentivesPaise: number;
  earningCount: number;
}

export interface WeekSummary {
  /** Monday of the week, as an Asia/Kolkata day key. */
  weekStart: string;
  netPaise: number;
  /** Exactly seven entries, Mon–Sun; zero-filled for empty days. */
  days: DaySummary[];
}

export interface IncentiveGap {
  platform: string;
  promisedPaise: number;
  creditedPaise: number;
  /** promised − credited; positive means money promised but not (yet) seen. */
  gapPaise: number;
}

function earningNet(e: Earning): number {
  return e.netPayout ?? e.grossAmount;
}

function emptyDay(day: string): DaySummary {
  return {
    day,
    netPaise: 0,
    earningsPaise: 0,
    incentivesPaise: 0,
    expensesPaise: 0,
    earningCount: 0,
  };
}

/** Per-day net, sorted by day ascending. Only days with activity appear. */
export function netByDay(
  earnings: readonly Earning[],
  incentives: readonly IncentiveEvent[],
  expenses: readonly Expense[],
): DaySummary[] {
  const byDay = new Map<string, DaySummary>();
  const dayOf = (iso: string) => {
    const day = istDayKey(iso);
    let entry = byDay.get(day);
    if (!entry) {
      entry = emptyDay(day);
      byDay.set(day, entry);
    }
    return entry;
  };

  for (const e of earnings) {
    const d = dayOf(e.timestamp);
    d.earningsPaise += earningNet(e);
    d.earningCount += 1;
  }
  for (const i of incentives) {
    if (i.creditedAmount !== undefined) {
      dayOf(i.timestamp).incentivesPaise += i.creditedAmount;
    }
  }
  for (const x of expenses) {
    dayOf(x.timestamp).expensesPaise += x.amount;
  }
  for (const d of byDay.values()) {
    d.netPaise = d.earningsPaise + d.incentivesPaise - d.expensesPaise;
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Per-platform net over the given rows, sorted by net descending. */
export function netByPlatform(
  earnings: readonly Earning[],
  incentives: readonly IncentiveEvent[],
): PlatformSummary[] {
  const byPlatform = new Map<string, PlatformSummary>();
  const platformOf = (platform: string) => {
    let entry = byPlatform.get(platform);
    if (!entry) {
      entry = { platform, netPaise: 0, earningsPaise: 0, incentivesPaise: 0, earningCount: 0 };
      byPlatform.set(platform, entry);
    }
    return entry;
  };

  for (const e of earnings) {
    const p = platformOf(e.platform);
    p.earningsPaise += earningNet(e);
    p.earningCount += 1;
  }
  for (const i of incentives) {
    if (i.creditedAmount !== undefined) {
      platformOf(i.platform).incentivesPaise += i.creditedAmount;
    }
  }
  for (const p of byPlatform.values()) {
    p.netPaise = p.earningsPaise + p.incentivesPaise;
  }
  return [...byPlatform.values()].sort((a, b) => b.netPaise - a.netPaise);
}

/**
 * Summary of the Asia/Kolkata week (Mon–Sun) containing `isoInWeek`.
 * Rows outside that week are ignored; empty days are zero-filled so the UI's
 * week strip always has seven bars.
 */
export function weekSummary(
  isoInWeek: string,
  earnings: readonly Earning[],
  incentives: readonly IncentiveEvent[],
  expenses: readonly Expense[],
): WeekSummary {
  const weekStart = istWeekKey(isoInWeek);
  const weekDays = istWeekDays(isoInWeek);
  const inWeek = new Set(weekDays);

  const days = netByDay(
    earnings.filter((e) => inWeek.has(istDayKey(e.timestamp))),
    incentives.filter((i) => inWeek.has(istDayKey(i.timestamp))),
    expenses.filter((x) => inWeek.has(istDayKey(x.timestamp))),
  );
  const byDay = new Map(days.map((d) => [d.day, d]));
  const filled = weekDays.map((day) => byDay.get(day) ?? emptyDay(day));
  const netPaise = filled.reduce((sum, d) => sum + d.netPaise, 0);
  return { weekStart, netPaise, days: filled };
}

/** Promised-vs-credited incentive gap per platform (PRD F3 supporting view). */
export function incentiveGap(incentives: readonly IncentiveEvent[]): IncentiveGap[] {
  const byPlatform = new Map<string, IncentiveGap>();
  for (const i of incentives) {
    let entry = byPlatform.get(i.platform);
    if (!entry) {
      entry = { platform: i.platform, promisedPaise: 0, creditedPaise: 0, gapPaise: 0 };
      byPlatform.set(i.platform, entry);
    }
    entry.promisedPaise += i.promisedAmount;
    entry.creditedPaise += i.creditedAmount ?? 0;
  }
  for (const g of byPlatform.values()) {
    g.gapPaise = g.promisedPaise - g.creditedPaise;
  }
  return [...byPlatform.values()].sort((a, b) => b.gapPaise - a.gapPaise);
}
