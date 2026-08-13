import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { parseRawInput } from "@hisaab/parsers";
import { FixtureSchema } from "../fixture-schema.js";
import { formatRate, renderMarkdownTable, renderTable } from "../report.js";

export interface FixtureFailure {
  file: string;
  reason: string;
}

export interface FixtureRunReport {
  total: number;
  passed: number;
  byPlatform: Record<string, { total: number; passed: number }>;
  failures: FixtureFailure[];
}

/** Default corpus: the fixtures shipped inside @hisaab/parsers. */
export function defaultFixturesDir(): string {
  const require = createRequire(import.meta.url);
  const parsersEntry = require.resolve("@hisaab/parsers");
  return join(dirname(parsersEntry), "..", "fixtures");
}

export function runFixtures(dir: string): FixtureRunReport {
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.split(sep).join("/"))
    .sort();

  const report: FixtureRunReport = { total: 0, passed: 0, byPlatform: {}, failures: [] };

  for (const file of files) {
    const platform = file.includes("/") ? (file.split("/")[0] as string) : ".";
    let bucket = report.byPlatform[platform];
    if (!bucket) {
      bucket = { total: 0, passed: 0 };
      report.byPlatform[platform] = bucket;
    }
    report.total += 1;
    bucket.total += 1;

    let ok = false;
    let reason = "";
    try {
      const fixture = FixtureSchema.parse(JSON.parse(readFileSync(join(dir, file), "utf8")));
      const result = parseRawInput(fixture.input);
      if (fixture.expected === null) {
        ok = result.status === "unparsed";
        if (!ok) reason = `expected unparsed, got ${result.status}`;
      } else if (fixture.expected === "ignored") {
        ok = result.status === "ignored";
        if (!ok) reason = `expected ignored, got ${result.status}`;
      } else if (result.status !== "parsed") {
        reason = `expected parsed, got ${result.status}`;
      } else {
        ok = JSON.stringify(result.event) === JSON.stringify(fixture.expected);
        if (!ok) {
          reason = `event mismatch:\n  expected ${JSON.stringify(fixture.expected)}\n  actual   ${JSON.stringify(result.event)}`;
        }
      }
    } catch (error) {
      reason = `fixture error: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (ok) {
      report.passed += 1;
      bucket.passed += 1;
    } else {
      report.failures.push({ file, reason });
    }
  }

  return report;
}

function platformRows(report: FixtureRunReport): string[][] {
  return Object.entries(report.byPlatform)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([platform, { total, passed }]) => [
      platform,
      String(total),
      String(passed),
      String(total - passed),
      formatRate(total === 0 ? null : passed / total),
    ]);
}

export function runFixturesCommand(
  dir: string | undefined,
  opts: { json: boolean; summary: boolean },
): number {
  const fixturesDir = dir ?? defaultFixturesDir();
  const report = runFixtures(fixturesDir);
  const header = ["platform", "fixtures", "pass", "fail", "pass rate"];

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (opts.summary) {
    console.log("## Parser fixture run\n");
    console.log(renderMarkdownTable(header, platformRows(report)));
    console.log(
      `\n**${report.passed}/${report.total} fixtures pass** (parser pack corpus: \`${fixturesDir}\`)`,
    );
    if (report.failures.length > 0) {
      console.log("\n### Failures\n");
      for (const f of report.failures) console.log(`- \`${f.file}\`: ${f.reason}`);
    }
  } else {
    console.log(renderTable(header, platformRows(report)));
    console.log(`\n${report.passed}/${report.total} fixtures pass`);
    for (const f of report.failures) console.log(`\nFAIL ${f.file}\n  ${f.reason}`);
  }

  return report.failures.length === 0 ? 0 : 1;
}
