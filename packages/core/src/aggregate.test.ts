import { describe, expect, it } from "vitest";
import { incentiveGap, netByDay, netByPlatform, weekSummary } from "./aggregate.js";
import type { Earning, Expense, IncentiveEvent } from "./types/index.js";

function earning(overrides: Partial<Earning>): Earning {
  return {
    type: "earning",
    platform: "swiggy",
    timestamp: "2026-08-12T19:00:00+05:30",
    kind: "order",
    grossAmount: 4200,
    ...overrides,
  };
}

function incentive(overrides: Partial<IncentiveEvent>): IncentiveEvent {
  return {
    type: "incentive",
    platform: "swiggy",
    timestamp: "2026-08-12T21:00:00+05:30",
    promisedAmount: 10000,
    criteriaText: "Complete 10 orders",
    ...overrides,
  };
}

const fuel: Expense = {
  category: "fuel",
  amount: 15000,
  timestamp: "2026-08-12T09:00:00+05:30",
};

describe("netByDay", () => {
  it("computes net = earnings + credited incentives − expenses per IST day", () => {
    const days = netByDay(
      [earning({}), earning({ grossAmount: 3500 })],
      [incentive({ creditedAmount: 5000 })],
      [fuel],
    );
    expect(days).toHaveLength(1);
    const day = days[0];
    expect(day?.day).toBe("2026-08-12");
    expect(day?.earningsPaise).toBe(7700);
    expect(day?.incentivesPaise).toBe(5000);
    expect(day?.expensesPaise).toBe(15000);
    expect(day?.netPaise).toBe(7700 + 5000 - 15000);
    expect(day?.earningCount).toBe(2);
  });

  it("prefers netPayout over grossAmount when present", () => {
    const days = netByDay([earning({ grossAmount: 5000, netPayout: 4600 })], [], []);
    expect(days[0]?.earningsPaise).toBe(4600);
  });

  it("counts promised-but-not-credited incentives as zero", () => {
    const days = netByDay([earning({})], [incentive({})], []);
    expect(days[0]?.incentivesPaise).toBe(0);
  });

  it("includes negative adjustments (penalties) in the net (UX E4)", () => {
    const days = netByDay(
      [earning({}), earning({ kind: "adjustment", grossAmount: -2000 })],
      [],
      [],
    );
    expect(days[0]?.earningsPaise).toBe(2200);
  });

  it("splits events across the IST midnight boundary (UX E5)", () => {
    const days = netByDay(
      [
        earning({ timestamp: "2026-08-12T23:45:00+05:30" }),
        earning({ timestamp: "2026-08-13T00:15:00+05:30", grossAmount: 3000 }),
      ],
      [],
      [],
    );
    expect(days.map((d) => d.day)).toEqual(["2026-08-12", "2026-08-13"]);
    expect(days[0]?.earningsPaise).toBe(4200);
    expect(days[1]?.earningsPaise).toBe(3000);
  });
});

describe("netByPlatform", () => {
  it("groups by platform, sorted by net descending", () => {
    const rows = netByPlatform(
      [
        earning({ platform: "zepto", grossAmount: 46000 }),
        earning({ platform: "swiggy", grossAmount: 52000 }),
        earning({ platform: "zepto", grossAmount: 1000 }),
      ],
      [incentive({ platform: "zepto", creditedAmount: 8000 })],
    );
    expect(rows.map((r) => r.platform)).toEqual(["zepto", "swiggy"]);
    expect(rows[0]?.netPaise).toBe(46000 + 1000 + 8000);
    expect(rows[0]?.earningCount).toBe(2);
  });
});

describe("weekSummary", () => {
  it("zero-fills the Mon–Sun strip and ignores rows outside the week", () => {
    const week = weekSummary(
      "2026-08-13T12:00:00+05:30",
      [
        earning({ timestamp: "2026-08-12T19:00:00+05:30" }),
        // Previous week — must be excluded.
        earning({ timestamp: "2026-08-08T19:00:00+05:30", grossAmount: 99900 }),
      ],
      [],
      [fuel],
    );
    expect(week.weekStart).toBe("2026-08-10");
    expect(week.days).toHaveLength(7);
    expect(week.days.map((d) => d.day)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
    expect(week.netPaise).toBe(4200 - 15000);
    expect(week.days[0]?.netPaise).toBe(0);
  });
});

describe("incentiveGap", () => {
  it("reports promised − credited per platform", () => {
    const gaps = incentiveGap([
      incentive({ platform: "zomato", promisedAmount: 214000, creditedAmount: 198000 }),
      incentive({ platform: "swiggy", promisedAmount: 10000, creditedAmount: 10000 }),
    ]);
    expect(gaps[0]).toEqual({
      platform: "zomato",
      promisedPaise: 214000,
      creditedPaise: 198000,
      gapPaise: 16000,
    });
    expect(gaps[1]?.gapPaise).toBe(0);
  });
});
