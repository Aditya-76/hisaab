import type { NormalizedEvent } from "@hisaab/core";
import { PARSER_PACK_VERSION, parseRawInput } from "@hisaab/parsers";
import type { Db, DbExecutor } from "../db/db.js";
import { writeEarning, writeIncentive, writePayoutCredit } from "../db/normalized.js";
import { markDrainOutcome, readUnparsedBatch, type UnparsedRow } from "../db/raw-events.js";
import { PARSED_STATE } from "../db/schema.js";

export interface DrainResult {
  scanned: number;
  parsed: number;
  ignored: number;
  unparsed: number;
  /** Rows that parsed but were exact repeats of an existing earning (UX E1). */
  duplicates: number;
  /** Rows whose earning superseded an earlier revision (UX E3). */
  superseded: number;
  /** Rows that threw during parse or write — marked parse_error, kept. */
  errors: number;
}

export interface DrainOptions {
  batchSize?: number;
  /** Parser pack version stamp; injectable for tests. */
  parserPackVersion?: string;
}

async function writeNormalized(
  tx: DbExecutor,
  event: NormalizedEvent,
  rawEventId: number,
): Promise<"inserted" | "duplicate" | "superseded"> {
  switch (event.type) {
    case "earning":
      return (await writeEarning(tx, event, rawEventId)).action;
    case "incentive":
      await writeIncentive(tx, event, rawEventId);
      return "inserted";
    case "payout":
      await writePayoutCredit(tx, event, rawEventId);
      return "inserted";
  }
}

/**
 * Drain the unparsed queue: parse `parsed = 0` rows in batches and write
 * normalized rows, one transaction per batch (TECH-DESIGN §5.3). Parsing is
 * pure and happens outside the transaction; only writes happen inside.
 *
 * Every attempted row gets stamped with the parser-pack version, so a drain
 * converges (nothing is retried until the parser pack changes) and a parser
 * upgrade automatically re-qualifies the unparsed backlog (TECH-DESIGN §3).
 * No outcome ever deletes a raw event — data is never silently dropped.
 */
export async function drainRawEvents(db: Db, options: DrainOptions = {}): Promise<DrainResult> {
  const batchSize = options.batchSize ?? 200;
  const packVersion = options.parserPackVersion ?? PARSER_PACK_VERSION;
  const result: DrainResult = {
    scanned: 0,
    parsed: 0,
    ignored: 0,
    unparsed: 0,
    duplicates: 0,
    superseded: 0,
    errors: 0,
  };

  for (;;) {
    const batch = await readUnparsedBatch(db, packVersion, batchSize);
    if (batch.length === 0) break;
    result.scanned += batch.length;

    // Pure phase: no I/O. A parser throwing is already contained inside
    // parseRawInput; a throw here means the stored row itself is malformed.
    const outcomes = batch.map((row) => {
      try {
        return { row, parse: parseRawInput(row.input) };
      } catch {
        return { row, parse: null };
      }
    });

    await db.transaction(async (tx) => {
      for (const { row, parse } of outcomes) {
        if (parse === null) {
          await markDrainOutcome(tx, row.id, PARSED_STATE.parse_error, packVersion);
          result.errors += 1;
          continue;
        }
        switch (parse.status) {
          case "parsed": {
            const written = await tryWrite(tx, row, parse.event, packVersion, result);
            if (written === "duplicate") result.duplicates += 1;
            else if (written === "superseded") result.superseded += 1;
            if (written !== "error") result.parsed += 1;
            break;
          }
          case "ignored":
            await markDrainOutcome(tx, row.id, PARSED_STATE.ignored, packVersion);
            result.ignored += 1;
            break;
          case "unparsed":
            await markDrainOutcome(tx, row.id, PARSED_STATE.unparsed, packVersion);
            result.unparsed += 1;
            break;
        }
      }
    });

    if (batch.length < batchSize) break;
  }
  return result;
}

async function tryWrite(
  tx: DbExecutor,
  row: UnparsedRow,
  event: NormalizedEvent,
  packVersion: string,
  result: DrainResult,
): Promise<"inserted" | "duplicate" | "superseded" | "error"> {
  try {
    const action = await writeNormalized(tx, event, row.id);
    await markDrainOutcome(tx, row.id, PARSED_STATE.parsed, packVersion);
    return action;
  } catch {
    await markDrainOutcome(tx, row.id, PARSED_STATE.parse_error, packVersion);
    result.errors += 1;
    return "error";
  }
}
