import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runFixtures } from "./run-fixtures.js";

// The repo's real corpus — this doubles as an end-to-end test of the whole
// stack: fixture schema → registry → parsers → normalized events.
const corpusDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "parsers",
  "fixtures",
);

describe("runFixtures on the shipped corpus", () => {
  it("passes 100% of fixtures", () => {
    const report = runFixtures(corpusDir);
    expect(report.total).toBeGreaterThan(20);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.total);
  });

  it("reports per-platform buckets for all wave-1 platforms", () => {
    const report = runFixtures(corpusDir);
    expect(Object.keys(report.byPlatform).sort()).toEqual([
      "blinkit",
      "swiggy",
      "upi-sms",
      "zepto",
      "zomato",
    ]);
  });
});
