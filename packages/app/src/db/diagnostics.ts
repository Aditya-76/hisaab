import type { DbExecutor } from "./db.js";
import { CAPTURE_MARKER_PACKAGE, PARSED_STATE } from "./schema.js";

/**
 * Local-only diagnostics (INSTRUMENTATION §2–3). Events land in the
 * on-device diagnostics_log table and never leave the phone unless the
 * worker taps "Share my stats" (Phase 4). Props never contain money
 * amounts, raw text, or free-form input — if it's not in the
 * INSTRUMENTATION doc's taxonomy, don't log it.
 */

/** Retention for diagnostics_log rows (INSTRUMENTATION §2). */
export const DIAGNOSTICS_RETENTION_DAYS = 180;

export type DiagnosticProps = Record<string, string | number | boolean>;

export async function logDiagnostic(
  db: DbExecutor,
  event: string,
  at: string,
  props?: DiagnosticProps,
): Promise<void> {
  await db.execute("INSERT INTO diagnostics_log (event, at, props) VALUES (?, ?, ?)", [
    event,
    at,
    props === undefined ? null : JSON.stringify(props),
  ]);
}

/** Delete log rows older than `cutoffIso` (caller computes now − 180d). */
export async function pruneDiagnostics(db: DbExecutor, cutoffIso: string): Promise<number> {
  await db.execute("DELETE FROM diagnostics_log WHERE at < ?", [cutoffIso]);
  const { rows } = await db.execute("SELECT changes() AS n");
  return (rows[0]?.n as number) ?? 0;
}

/**
 * Parse coverage per platform (the committed metric, INSTRUMENTATION §3):
 * parsed / (parsed + unparsed), computed over raw_events — the tables are
 * ground truth, not the log. `ignored` rows are excluded from the
 * denominator; parse errors are surfaced separately, not hidden in either
 * bucket. Same formula the CLI ships, so CI, maintainers and the app agree.
 */
export interface PlatformCoverage {
  /** Platform id when the package/sender is known, else "unknown". */
  platform: string;
  parsed: number;
  unparsed: number;
  errors: number;
  /** parsed / (parsed + unparsed); null when the denominator is zero. */
  coverage: number | null;
}

export interface CaptureCounts {
  captured: number;
  parsed: number;
  unparsed: number;
  ignored: number;
  errors: number;
  gapMarkers: number;
}

/**
 * Map a raw_events row to a platform bucket. Notifications map by package
 * name via the parser registry's package list (passed in so this module
 * stays free of parser imports); every SMS routes to the one SMS pipeline.
 */
function platformBucket(
  source: string,
  packageName: string | null,
  packageToPlatform: ReadonlyMap<string, string>,
): string {
  if (source === "sms") return "upi-sms";
  if (packageName !== null) return packageToPlatform.get(packageName) ?? "unknown";
  return "unknown";
}

export async function coverageByPlatform(
  db: DbExecutor,
  packageToPlatform: ReadonlyMap<string, string>,
): Promise<PlatformCoverage[]> {
  const { rows } = await db.execute(
    `SELECT source, package_name, parsed, COUNT(*) AS cnt
     FROM raw_events
     WHERE package_name IS NULL OR package_name != ?
     GROUP BY source, package_name, parsed`,
    [CAPTURE_MARKER_PACKAGE],
  );
  const buckets = new Map<string, PlatformCoverage>();
  for (const row of rows) {
    const platform = platformBucket(
      String(row.source),
      row.package_name != null ? String(row.package_name) : null,
      packageToPlatform,
    );
    let bucket = buckets.get(platform);
    if (!bucket) {
      bucket = { platform, parsed: 0, unparsed: 0, errors: 0, coverage: null };
      buckets.set(platform, bucket);
    }
    const count = row.cnt as number;
    if (row.parsed === PARSED_STATE.parsed) bucket.parsed += count;
    else if (row.parsed === PARSED_STATE.unparsed) bucket.unparsed += count;
    else if (row.parsed === PARSED_STATE.parse_error) bucket.errors += count;
    // ignored rows are excluded from the metric entirely (INSTRUMENTATION §3)
  }
  for (const bucket of buckets.values()) {
    const denominator = bucket.parsed + bucket.unparsed;
    bucket.coverage = denominator === 0 ? null : bucket.parsed / denominator;
  }
  return [...buckets.values()].sort((a, b) => a.platform.localeCompare(b.platform));
}

/** Headline capture counts for the Diagnostics screen. */
export async function captureCounts(db: DbExecutor): Promise<CaptureCounts> {
  const { rows } = await db.execute(
    `SELECT parsed, package_name = ? AS is_marker, COUNT(*) AS cnt
     FROM raw_events
     GROUP BY parsed, package_name = ?`,
    [CAPTURE_MARKER_PACKAGE, CAPTURE_MARKER_PACKAGE],
  );
  const counts: CaptureCounts = {
    captured: 0,
    parsed: 0,
    unparsed: 0,
    ignored: 0,
    errors: 0,
    gapMarkers: 0,
  };
  for (const row of rows) {
    const count = row.cnt as number;
    if (row.is_marker === 1) {
      counts.gapMarkers += count;
      continue;
    }
    counts.captured += count;
    if (row.parsed === PARSED_STATE.parsed) counts.parsed += count;
    else if (row.parsed === PARSED_STATE.unparsed) counts.unparsed += count;
    else if (row.parsed === PARSED_STATE.ignored) counts.ignored += count;
    else if (row.parsed === PARSED_STATE.parse_error) counts.errors += count;
  }
  return counts;
}
