import type { ParseResult } from "@hisaab/parsers";
import { describe, expect, it } from "vitest";
import { computeCoverage } from "./coverage.js";

const TS = "2026-08-12T19:42:00+05:30";

function parsed(platform: string): ParseResult {
  return {
    status: "parsed",
    event: {
      type: "earning",
      platform,
      timestamp: TS,
      kind: "order",
      grossAmount: 4200,
    },
    parserId: `${platform}/order-delivered`,
    parserPackVersion: "0.1.0",
  };
}

describe("computeCoverage (the committed metric, PRD §15)", () => {
  it("computes parsed/(parsed+unparsed) per platform", () => {
    const report = computeCoverage([
      parsed("swiggy"),
      parsed("swiggy"),
      parsed("swiggy"),
      { status: "unparsed", platformGuess: "swiggy" },
      parsed("zepto"),
    ]);
    expect(report.coverage.swiggy).toBeCloseTo(0.75);
    expect(report.coverage.zepto).toBe(1);
    expect(report.overall).toBeCloseTo(0.8);
    expect(report.counts).toEqual({ captured: 5, parsed: 4, unparsed: 1, ignored: 0 });
  });

  it("EXCLUDES ignored from the denominator (INSTRUMENTATION §3)", () => {
    const report = computeCoverage([
      parsed("swiggy"),
      { status: "ignored", platform: "swiggy" },
      { status: "ignored", platform: "swiggy" },
      { status: "ignored", platform: "swiggy" },
    ]);
    // 1 parsed, 0 unparsed → 100%, no matter how much chatter was ignored.
    expect(report.coverage.swiggy).toBe(1);
    expect(report.overall).toBe(1);
    expect(report.counts.ignored).toBe(3);
  });

  it("buckets unparsed events with no platform guess under 'unknown'", () => {
    const report = computeCoverage([{ status: "unparsed" }]);
    expect(report.coverage.unknown).toBe(0);
  });

  it("returns null overall when nothing counts toward the denominator", () => {
    expect(computeCoverage([]).overall).toBeNull();
    expect(computeCoverage([{ status: "ignored", platform: "swiggy" }]).overall).toBeNull();
  });
});
