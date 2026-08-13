import { type Earning, type IncentiveEvent, istDayKey, type PayoutCredit } from "@hisaab/core";
import type { DbExecutor, SqlRow } from "./db.js";

export type EarningWriteAction = "inserted" | "duplicate" | "superseded";

export interface EarningWriteResult {
  action: EarningWriteAction;
  /** Row id of the current (non-superseded) earning after the write. */
  id: number;
}

function sameMoney(row: SqlRow, e: Earning): boolean {
  return (
    row.gross_amount === e.grossAmount &&
    (row.tips ?? null) === (e.tips ?? null) &&
    (row.surge ?? null) === (e.surge ?? null) &&
    (row.net_payout ?? null) === (e.netPayout ?? null) &&
    row.kind === e.kind
  );
}

async function insertEarningRow(tx: DbExecutor, e: Earning, rawEventId: number): Promise<number> {
  const { rows } = await tx.execute(
    `INSERT INTO earnings (raw_event_id, platform, kind, gross_amount, tips, surge, net_payout, distance_km, external_id, occurred_at, day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      rawEventId,
      e.platform,
      e.kind,
      e.grossAmount,
      e.tips ?? null,
      e.surge ?? null,
      e.netPayout ?? null,
      e.distanceKm ?? null,
      e.externalId ?? null,
      e.timestamp,
      istDayKey(e.timestamp),
    ],
  );
  return rows[0]?.id as number;
}

/**
 * Write an Earning with platform-id dedupe and revision supersedence
 * (UX E1/E3): a repeat notification with identical money is a duplicate
 * (no write); the same external_id with different money is a platform
 * revision — the old row is kept and marked superseded_by the new one, so
 * totals use only current rows while the trail stays auditable.
 *
 * Must run inside the drain transaction: the partial unique index
 * idx_earn_dedupe holds at commit via the sentinel-then-fix sequence below.
 */
export async function writeEarning(
  tx: DbExecutor,
  e: Earning,
  rawEventId: number,
): Promise<EarningWriteResult> {
  if (e.externalId !== undefined) {
    const { rows } = await tx.execute(
      `SELECT id, kind, gross_amount, tips, surge, net_payout
       FROM earnings WHERE platform = ? AND external_id = ? AND superseded_by IS NULL`,
      [e.platform, e.externalId],
    );
    const existing = rows[0];
    if (existing !== undefined) {
      const existingId = existing.id as number;
      if (sameMoney(existing, e)) return { action: "duplicate", id: existingId };
      // Revision: free the unique slot first with a FK-safe self-reference
      // sentinel ("superseded, successor pending"), insert the new current
      // row, then point the old row at it. All inside one transaction.
      await tx.execute("UPDATE earnings SET superseded_by = id WHERE id = ?", [existingId]);
      const newId = await insertEarningRow(tx, e, rawEventId);
      await tx.execute("UPDATE earnings SET superseded_by = ? WHERE id = ?", [newId, existingId]);
      return { action: "superseded", id: newId };
    }
  }
  return { action: "inserted", id: await insertEarningRow(tx, e, rawEventId) };
}

export async function writeIncentive(
  tx: DbExecutor,
  e: IncentiveEvent,
  rawEventId: number,
): Promise<number> {
  const { rows } = await tx.execute(
    `INSERT INTO incentive_events (raw_event_id, platform, promised_amount, credited_amount, criteria_text, occurred_at, day)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      rawEventId,
      e.platform,
      e.promisedAmount,
      e.creditedAmount ?? null,
      e.criteriaText,
      e.timestamp,
      istDayKey(e.timestamp),
    ],
  );
  return rows[0]?.id as number;
}

export async function writePayoutCredit(
  tx: DbExecutor,
  e: PayoutCredit,
  rawEventId: number,
): Promise<number> {
  const { rows } = await tx.execute(
    `INSERT INTO payout_credits (raw_event_id, source, amount, credited_at, narration, account_hint)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [rawEventId, e.source, e.amount, e.timestamp, e.narration ?? null, e.accountHint ?? null],
  );
  return rows[0]?.id as number;
}
