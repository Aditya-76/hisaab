import type { RawInput } from "@hisaab/core";
import type { DbExecutor, SqlValue } from "./db.js";
import { CAPTURE_MARKER_PACKAGE, PARSED_STATE, type ParsedStateCode } from "./schema.js";

/** One raw_events row as the drainer reads it (parsed = 0 batch). */
export interface UnparsedRow {
  id: number;
  input: RawInput;
}

/**
 * Read the next batch of rows the current parser pack hasn't seen:
 * still-unparsed rows that were last attempted by a DIFFERENT pack version
 * (or never attempted). Stamping attempts with the pack version is what
 * makes the re-parse pipeline free: ship new parsers → the backlog
 * re-qualifies itself (TECH-DESIGN §3).
 */
export async function readUnparsedBatch(
  db: DbExecutor,
  parserPackVersion: string,
  limit: number,
): Promise<UnparsedRow[]> {
  const { rows } = await db.execute(
    `SELECT id, source, package_name, sender, title, text, posted_at, app_version
     FROM raw_events
     WHERE parsed = ? AND (parser_pack_version IS NULL OR parser_pack_version != ?)
     ORDER BY id
     LIMIT ?`,
    [PARSED_STATE.unparsed, parserPackVersion, limit],
  );
  return rows.map((row) => ({
    id: row.id as number,
    input: {
      source: row.source as RawInput["source"],
      ...(row.package_name != null ? { packageName: String(row.package_name) } : {}),
      ...(row.sender != null ? { sender: String(row.sender) } : {}),
      ...(row.title != null ? { title: String(row.title) } : {}),
      text: String(row.text),
      postedAt: String(row.posted_at),
      ...(row.app_version != null ? { appVersion: String(row.app_version) } : {}),
    },
  }));
}

/** Stamp a drain attempt's outcome on a raw event. */
export async function markDrainOutcome(
  tx: DbExecutor,
  id: number,
  state: ParsedStateCode,
  parserPackVersion: string,
): Promise<void> {
  await tx.execute("UPDATE raw_events SET parsed = ?, parser_pack_version = ? WHERE id = ?", [
    state,
    parserPackVersion,
    id,
  ]);
}

export interface InsertRawEventInput {
  source: "notification" | "sms";
  packageName?: string;
  sender?: string;
  title?: string;
  text: string;
  postedAt: string;
  capturedAt: string;
  appVersion?: string;
  dedupeKey?: string;
}

/**
 * JS-side insert, used by tests and (later) the contribution flow. The
 * production capture path writes from Kotlin (RawEventStore.kt) — same
 * columns, same dedupe upsert.
 */
export async function insertRawEvent(db: DbExecutor, event: InsertRawEventInput): Promise<number> {
  const params: SqlValue[] = [
    event.source,
    event.packageName ?? null,
    event.sender ?? null,
    event.title ?? null,
    event.text,
    event.postedAt,
    event.capturedAt,
    event.appVersion ?? null,
    event.dedupeKey ?? null,
  ];
  const { rows } = await db.execute(
    `INSERT INTO raw_events (source, package_name, sender, title, text, posted_at, captured_at, app_version, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL
     DO UPDATE SET captured_at = excluded.captured_at
     RETURNING id`,
    params,
  );
  return rows[0]?.id as number;
}

/** Unparsed queue size for the Inbox badge (excludes capture markers). */
export async function countUnparsed(db: DbExecutor): Promise<number> {
  const { rows } = await db.execute(
    "SELECT COUNT(*) AS n FROM raw_events WHERE parsed = ? AND (package_name IS NULL OR package_name != ?)",
    [PARSED_STATE.unparsed, CAPTURE_MARKER_PACKAGE],
  );
  return (rows[0]?.n as number) ?? 0;
}

/** Rows for the unparsed-queue screen, newest first (UX §3.4). */
export interface UnparsedListItem {
  id: number;
  source: string;
  platformHint: string | null;
  title: string | null;
  text: string;
  postedAt: string;
}

export async function listUnparsed(db: DbExecutor, limit: number): Promise<UnparsedListItem[]> {
  const { rows } = await db.execute(
    `SELECT id, source, package_name, sender, title, text, posted_at
     FROM raw_events
     WHERE parsed = ? AND (package_name IS NULL OR package_name != ?)
     ORDER BY posted_at DESC
     LIMIT ?`,
    [PARSED_STATE.unparsed, CAPTURE_MARKER_PACKAGE, limit],
  );
  return rows.map((row) => ({
    id: row.id as number,
    source: String(row.source),
    platformHint:
      row.package_name != null
        ? String(row.package_name)
        : row.sender != null
          ? String(row.sender)
          : null,
    title: row.title != null ? String(row.title) : null,
    text: String(row.text),
    postedAt: String(row.posted_at),
  }));
}
