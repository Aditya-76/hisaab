import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RawInputSchema } from "@hisaab/core";
import { type ParseResult, parseRawInput } from "@hisaab/parsers";
import { formatRate, renderTable } from "../report.js";

/**
 * Parse coverage — THE committed metric (PRD §15, DECISIONS D-010):
 *
 *   coverage = parsed / (parsed + unparsed)
 *
 * `ignored` events are excluded from the denominator, and the ignore list is
 * itself fixture-tested so this can't be gamed (docs/INSTRUMENTATION.md §3).
 * This function is the single implementation — the CLI, CI, and the app's
 * on-device diagnostics must all use it so every coverage number means the
 * same thing.
 */
export interface CoverageReport {
  coverage: Record<string, number>;
  overall: number | null;
  counts: { captured: number; parsed: number; unparsed: number; ignored: number };
}

export function computeCoverage(results: readonly ParseResult[]): CoverageReport {
  const perPlatform = new Map<string, { parsed: number; unparsed: number }>();
  const counts = { captured: results.length, parsed: 0, unparsed: 0, ignored: 0 };

  const bucket = (platform: string) => {
    let entry = perPlatform.get(platform);
    if (!entry) {
      entry = { parsed: 0, unparsed: 0 };
      perPlatform.set(platform, entry);
    }
    return entry;
  };

  for (const result of results) {
    if (result.status === "parsed") {
      counts.parsed += 1;
      // PayoutCredits come from bank/UPI SMS — they have a source, not a platform.
      const platform = result.event.type === "payout" ? "upi-sms" : result.event.platform;
      bucket(platform).parsed += 1;
    } else if (result.status === "unparsed") {
      counts.unparsed += 1;
      bucket(result.platformGuess ?? "unknown").unparsed += 1;
    } else {
      counts.ignored += 1;
    }
  }

  const coverage: Record<string, number> = {};
  for (const [platform, { parsed, unparsed }] of [...perPlatform.entries()].sort()) {
    coverage[platform] = parsed / (parsed + unparsed);
  }
  const denominator = counts.parsed + counts.unparsed;
  const overall = denominator === 0 ? null : counts.parsed / denominator;
  return { coverage, overall, counts };
}

/** `hisaab-cli coverage <dir>` — dir holds RawInput JSON dumps (object or array per file). */
export function coverageCommand(dir: string, opts: { json: boolean }): number {
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) =>
    f.endsWith(".json"),
  );
  const results: ParseResult[] = [];
  for (const file of files) {
    const raw: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const inputs = Array.isArray(raw) ? raw : [raw];
    for (const candidate of inputs) {
      results.push(parseRawInput(RawInputSchema.parse(candidate)));
    }
  }

  const report = computeCoverage(results);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const rows = Object.entries(report.coverage).map(([platform, rate]) => [
      platform,
      formatRate(rate),
    ]);
    console.log(renderTable(["platform", "coverage"], rows));
    console.log(
      `\ncaptured ${report.counts.captured} · parsed ${report.counts.parsed} · unparsed ${report.counts.unparsed} · ignored ${report.counts.ignored} (excluded from denominator)`,
    );
    console.log(`overall coverage: ${formatRate(report.overall)}`);
  }
  return 0;
}
