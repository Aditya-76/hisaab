import type { DaySummary, PlatformSummary } from "@hisaab/core";
import type { DbExecutor, SqlValue } from "./db.js";

/**
 * Dashboard reads (UX §3.2): SQL does the heavy lifting over the
 * precomputed `day` columns; JS only shapes rows (TECH-DESIGN §6). The
 * semantics mirror core/aggregate.ts exactly — net contribution of an
 * earning is COALESCE(net_payout, gross_amount), credited incentives add,
 * expenses subtract — and core's pure functions stay the executable spec
 * (dashboard.test.ts cross-checks the two).
 *
 * All earning reads filter `superseded_by IS NULL`: totals use only current
 * rows, revision trails stay in history (UX E3).
 */

function n(value: SqlValue | undefined): number {
  return typeof value === "number" ? value : 0;
}

/** One day's totals for the hero number (zero row when the day is empty). */
export async function daySummary(db: DbExecutor, day: string): Promise<DaySummary> {
  const [earn, inc, exp] = await Promise.all([
    db.execute(
      `SELECT COALESCE(SUM(COALESCE(net_payout, gross_amount)), 0) AS total, COUNT(*) AS cnt
       FROM earnings WHERE day = ? AND superseded_by IS NULL`,
      [day],
    ),
    db.execute(
      "SELECT COALESCE(SUM(credited_amount), 0) AS total FROM incentive_events WHERE day = ?",
      [day],
    ),
    db.execute("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE day = ?", [day]),
  ]);
  const earningsPaise = n(earn.rows[0]?.total);
  const incentivesPaise = n(inc.rows[0]?.total);
  const expensesPaise = n(exp.rows[0]?.total);
  return {
    day,
    earningsPaise,
    incentivesPaise,
    expensesPaise,
    netPaise: earningsPaise + incentivesPaise - expensesPaise,
    earningCount: n(earn.rows[0]?.cnt),
  };
}

/** Per-platform split for one day, net descending (UX §3.2 platform rows). */
export async function platformSplit(db: DbExecutor, day: string): Promise<PlatformSummary[]> {
  const { rows } = await db.execute(
    `SELECT platform,
            COALESCE(SUM(earnings_paise), 0) AS earnings_paise,
            COALESCE(SUM(incentives_paise), 0) AS incentives_paise,
            COALESCE(SUM(earning_count), 0) AS earning_count
     FROM (
       SELECT platform, COALESCE(net_payout, gross_amount) AS earnings_paise,
              0 AS incentives_paise, 1 AS earning_count
       FROM earnings WHERE day = ? AND superseded_by IS NULL
       UNION ALL
       SELECT platform, 0, credited_amount, 0
       FROM incentive_events WHERE day = ? AND credited_amount IS NOT NULL
     )
     GROUP BY platform
     ORDER BY (COALESCE(SUM(earnings_paise), 0) + COALESCE(SUM(incentives_paise), 0)) DESC`,
    [day, day],
  );
  return rows.map((row) => ({
    platform: String(row.platform),
    earningsPaise: n(row.earnings_paise),
    incentivesPaise: n(row.incentives_paise),
    netPaise: n(row.earnings_paise) + n(row.incentives_paise),
    earningCount: n(row.earning_count),
  }));
}

/**
 * Net per day for the week strip: exactly one entry per requested day key,
 * zero-filled, in the order given (callers pass core's istWeekDays — Mon–Sun).
 */
export async function weekStrip(db: DbExecutor, days: readonly string[]): Promise<DaySummary[]> {
  if (days.length === 0) return [];
  const marks = days.map(() => "?").join(", ");
  const params = [...days];
  const { rows } = await db.execute(
    `SELECT day,
            COALESCE(SUM(earnings_paise), 0) AS earnings_paise,
            COALESCE(SUM(incentives_paise), 0) AS incentives_paise,
            COALESCE(SUM(expenses_paise), 0) AS expenses_paise,
            COALESCE(SUM(earning_count), 0) AS earning_count
     FROM (
       SELECT day, COALESCE(net_payout, gross_amount) AS earnings_paise,
              0 AS incentives_paise, 0 AS expenses_paise, 1 AS earning_count
       FROM earnings WHERE day IN (${marks}) AND superseded_by IS NULL
       UNION ALL
       SELECT day, 0, credited_amount, 0, 0
       FROM incentive_events WHERE day IN (${marks}) AND credited_amount IS NOT NULL
       UNION ALL
       SELECT day, 0, 0, amount, 0
       FROM expenses WHERE day IN (${marks})
     )
     GROUP BY day`,
    [...params, ...params, ...params],
  );
  const byDay = new Map(rows.map((row) => [String(row.day), row]));
  return days.map((day) => {
    const row = byDay.get(day);
    const earningsPaise = n(row?.earnings_paise);
    const incentivesPaise = n(row?.incentives_paise);
    const expensesPaise = n(row?.expenses_paise);
    return {
      day,
      earningsPaise,
      incentivesPaise,
      expensesPaise,
      netPaise: earningsPaise + incentivesPaise - expensesPaise,
      earningCount: n(row?.earning_count),
    };
  });
}

/** One row of the Orders history list (current revisions only). */
export interface EarningListItem {
  id: number;
  platform: string;
  kind: string;
  /** Net contribution: netPayout ?? grossAmount. Negative for penalties (UX E4). */
  netPaise: number;
  tipsPaise: number | null;
  occurredAt: string;
  day: string;
}

/** Earnings history, newest first, optionally filtered (UX §2 Orders tab). */
export async function listEarnings(
  db: DbExecutor,
  opts: { day?: string; platform?: string; limit: number },
): Promise<EarningListItem[]> {
  const where = ["superseded_by IS NULL"];
  const params: SqlValue[] = [];
  if (opts.day !== undefined) {
    where.push("day = ?");
    params.push(opts.day);
  }
  if (opts.platform !== undefined) {
    where.push("platform = ?");
    params.push(opts.platform);
  }
  const { rows } = await db.execute(
    `SELECT id, platform, kind, COALESCE(net_payout, gross_amount) AS net_paise,
            tips, occurred_at, day
     FROM earnings
     WHERE ${where.join(" AND ")}
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [...params, opts.limit],
  );
  return rows.map((row) => ({
    id: row.id as number,
    platform: String(row.platform),
    kind: String(row.kind),
    netPaise: n(row.net_paise),
    tipsPaise: row.tips != null ? n(row.tips) : null,
    occurredAt: String(row.occurred_at),
    day: String(row.day),
  }));
}
