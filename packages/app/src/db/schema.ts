import { PARSED_STATES } from "@hisaab/core";

/**
 * The one SQLite database (TECH-DESIGN §4). Name is a contract with the
 * Kotlin capture module (RawEventStore.kt), which opens the same file.
 */
export const DB_NAME = "hisaab.db";

/**
 * raw_events DDL — DUAL-OWNED, see docs/DECISIONS.md D-024.
 *
 * The Kotlin capture module bootstraps this table so capture works before
 * the JS runtime has ever run (TECH-DESIGN §5.1); migration 001 runs the
 * same statements. Both sides use IF NOT EXISTS so either can go first.
 * This string must stay BYTE-IDENTICAL to RAW_EVENTS_SQL in
 * android/app/src/main/java/app/hisaab/capture/RawEventStore.kt —
 * schema-contract.test.ts fails CI if they drift.
 */
export const RAW_EVENTS_SQL = `
CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  package_name TEXT,
  sender TEXT,
  title TEXT,
  text TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  app_version TEXT,
  parsed INTEGER NOT NULL DEFAULT 0,
  parser_pack_version TEXT,
  contributed INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_raw_parsed ON raw_events(parsed, posted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_dedupe ON raw_events(dedupe_key) WHERE dedupe_key IS NOT NULL
`;

/**
 * Integer codes stored in raw_events.parsed. Order is the core
 * PARSED_STATES tuple (unparsed=0, parsed=1, parse_error=2, ignored=3) —
 * schema-contract.test.ts pins the mapping.
 */
export const PARSED_STATE = {
  unparsed: PARSED_STATES.indexOf("unparsed"),
  parsed: PARSED_STATES.indexOf("parsed"),
  parse_error: PARSED_STATES.indexOf("parse_error"),
  ignored: PARSED_STATES.indexOf("ignored"),
} as const;

export type ParsedStateCode = (typeof PARSED_STATE)[keyof typeof PARSED_STATE];

/**
 * Gap markers (capture outages, UX E2) are raw_events rows from this
 * pseudo-package, written with parsed=ignored so they never enter the parse
 * queue but stay visible to diagnostics (D-025). Contract with
 * RawEventStore.kt.
 */
export const CAPTURE_MARKER_PACKAGE = "app.hisaab.capture";

/** Normalized tables, owned solely by JS migrations (TECH-DESIGN §4). */
export const NORMALIZED_SQL = `
CREATE TABLE earnings (
  id INTEGER PRIMARY KEY,
  raw_event_id INTEGER REFERENCES raw_events(id),
  platform TEXT NOT NULL,
  kind TEXT NOT NULL,
  gross_amount INTEGER NOT NULL,
  tips INTEGER,
  surge INTEGER,
  net_payout INTEGER,
  distance_km REAL,
  external_id TEXT,
  occurred_at TEXT NOT NULL,
  day TEXT NOT NULL,
  superseded_by INTEGER REFERENCES earnings(id)
);
CREATE UNIQUE INDEX idx_earn_dedupe ON earnings(platform, external_id)
  WHERE external_id IS NOT NULL AND superseded_by IS NULL;
CREATE INDEX idx_earn_day ON earnings(day);
CREATE TABLE incentive_events (
  id INTEGER PRIMARY KEY,
  raw_event_id INTEGER REFERENCES raw_events(id),
  platform TEXT NOT NULL,
  promised_amount INTEGER NOT NULL,
  credited_amount INTEGER,
  criteria_text TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  day TEXT NOT NULL
);
CREATE INDEX idx_incentive_day ON incentive_events(platform, day);
CREATE TABLE payout_credits (
  id INTEGER PRIMARY KEY,
  raw_event_id INTEGER REFERENCES raw_events(id),
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  credited_at TEXT NOT NULL,
  narration TEXT,
  account_hint TEXT,
  match_status TEXT NOT NULL DEFAULT 'unmatched'
);
CREATE INDEX idx_payout_status ON payout_credits(match_status, credited_at);
CREATE TABLE payout_matches (
  id INTEGER PRIMARY KEY,
  payout_credit_id INTEGER NOT NULL REFERENCES payout_credits(id),
  platform TEXT NOT NULL,
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  confidence REAL NOT NULL
);
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  day TEXT NOT NULL,
  note TEXT
);
CREATE INDEX idx_expense_day ON expenses(day);
CREATE TABLE diagnostics_log (
  id INTEGER PRIMARY KEY,
  event TEXT NOT NULL,
  at TEXT NOT NULL,
  props TEXT
)
`;

/**
 * Key-value app settings (migration 002): language, later the platform
 * allowlist and retention toggles. A table, not AsyncStorage — one store,
 * one export/delete path, no extra dependency (D-027).
 */
export const SETTINGS_SQL = `
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
`;

/** Split a multi-statement DDL string into single executable statements. */
export function statementsOf(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
