import {
  type Earning,
  type Expense,
  type IncentiveEvent,
  istWeekDays,
  netByDay,
  netByPlatform,
  weekSummary,
} from "@hisaab/core";
import { describe, expect, it } from "vitest";
import { openNodeDb } from "../testing/node-db.js";
import { daySummary, listEarnings, platformSplit, weekStrip } from "./dashboard.js";
import { addExpense } from "./expenses.js";
import { migrate } from "./migrations.js";
import { writeEarning, writeIncentive } from "./normalized.js";
import { insertRawEvent } from "./raw-events.js";

/**
 * The SQL views must agree with core's pure aggregation functions — core is
 * the executable spec (TECH-DESIGN §6). Each test computes both and diffs.
 */

const earning = (over: Partial<Earning>): Earning => ({
  type: "earning",
  platform: "swiggy",
  timestamp: "2026-08-12T19:42:00+05:30",
  kind: "order",
  grossAmount: 4200,
  ...over,
});

const incentive = (over: Partial<IncentiveEvent>): IncentiveEvent => ({
  type: "incentive",
  platform: "swiggy",
  promisedAmount: 10000,
  criteriaText: "Complete 12 orders",
  timestamp: "2026-08-12T21:00:00+05:30",
  ...over,
});

const expense = (over: Partial<Expense>): Expense => ({
  category: "fuel",
  amount: 15000,
  timestamp: "2026-08-12T18:00:00+05:30",
  ...over,
});

interface Seed {
  earnings: Earning[];
  incentives: IncentiveEvent[];
  expenses: Expense[];
}

/** A realistic two-day, three-platform corpus incl. edge cases E3/E4. */
const SEED: Seed = {
  earnings: [
    earning({ grossAmount: 5200, netPayout: 5000, externalId: "S-1" }),
    earning({ grossAmount: 4600, externalId: "S-2", timestamp: "2026-08-12T20:10:00+05:30" }),
    earning({
      platform: "zepto",
      grossAmount: 3100,
      externalId: "Z-1",
      timestamp: "2026-08-12T13:05:00+05:30",
    }),
    // Negative adjustment (penalty, UX E4) counts against the day.
    earning({
      platform: "zepto",
      kind: "adjustment",
      grossAmount: -500,
      timestamp: "2026-08-12T14:00:00+05:30",
    }),
    // Previous day, other platform.
    earning({
      platform: "blinkit",
      grossAmount: 2800,
      externalId: "B-1",
      timestamp: "2026-08-11T19:00:00+05:30",
    }),
  ],
  incentives: [
    incentive({ creditedAmount: 8000 }),
    // Promised-only incentives don't add to net until credited.
    incentive({ platform: "zepto", timestamp: "2026-08-12T22:00:00+05:30" }),
  ],
  expenses: [expense({ amount: 15000 }), expense({ amount: 2000, category: "recharge" })],
};

async function seededDb(seed: Seed = SEED) {
  const db = openNodeDb();
  await migrate(db);
  const rawId = await insertRawEvent(db, {
    source: "notification",
    packageName: "in.swiggy.deliveryapp",
    text: "seed",
    postedAt: "2026-08-12T00:00:00+05:30",
    capturedAt: "2026-08-12T00:00:00+05:30",
  });
  await db.transaction(async (tx) => {
    for (const e of seed.earnings) await writeEarning(tx, e, rawId);
    for (const i of seed.incentives) await writeIncentive(tx, i, rawId);
  });
  for (const x of seed.expenses) await addExpense(db, x);
  return { db, rawId };
}

describe("daySummary", () => {
  it("matches core.netByDay for a busy day", async () => {
    const { db } = await seededDb();
    const spec = netByDay(SEED.earnings, SEED.incentives, SEED.expenses).find(
      (d) => d.day === "2026-08-12",
    );
    expect(await daySummary(db, "2026-08-12")).toEqual(spec);
    db.close();
  });

  it("returns an explicit zero row for an empty day (UX §5.1 zero-earnings state)", async () => {
    const { db } = await seededDb();
    expect(await daySummary(db, "2026-08-01")).toEqual({
      day: "2026-08-01",
      netPaise: 0,
      earningsPaise: 0,
      incentivesPaise: 0,
      expensesPaise: 0,
      earningCount: 0,
    });
    db.close();
  });

  it("uses only current rows after a revision (UX E3)", async () => {
    const { db, rawId } = await seededDb();
    const before = await daySummary(db, "2026-08-12");
    await db.transaction((tx) =>
      writeEarning(tx, earning({ grossAmount: 5200, netPayout: 4400, externalId: "S-1" }), rawId),
    );
    const after = await daySummary(db, "2026-08-12");
    expect(after.netPaise).toBe(before.netPaise - 600);
    expect(after.earningCount).toBe(before.earningCount);
    db.close();
  });
});

describe("platformSplit", () => {
  it("matches core.netByPlatform for the day, net descending", async () => {
    const { db } = await seededDb();
    const dayOf = (iso: string) => iso.startsWith("2026-08-12");
    const spec = netByPlatform(
      SEED.earnings.filter((e) => dayOf(e.timestamp)),
      SEED.incentives.filter((i) => dayOf(i.timestamp)),
    );
    expect(await platformSplit(db, "2026-08-12")).toEqual(spec);
    db.close();
  });

  it("is empty for an empty day", async () => {
    const { db } = await seededDb();
    expect(await platformSplit(db, "2026-08-01")).toEqual([]);
    db.close();
  });
});

describe("weekStrip", () => {
  it("matches core.weekSummary and zero-fills all seven days", async () => {
    const { db } = await seededDb();
    const anchor = "2026-08-12T12:00:00+05:30";
    const strip = await weekStrip(db, istWeekDays(anchor));
    const spec = weekSummary(anchor, SEED.earnings, SEED.incentives, SEED.expenses);
    expect(strip).toEqual(spec.days);
    expect(strip).toHaveLength(7);
    db.close();
  });

  it("returns [] for an empty day list", async () => {
    const { db } = await seededDb();
    expect(await weekStrip(db, [])).toEqual([]);
    db.close();
  });
});

describe("listEarnings", () => {
  it("lists a day newest first with net contribution amounts", async () => {
    const { db } = await seededDb();
    const items = await listEarnings(db, { day: "2026-08-12", limit: 50 });
    expect(items.map((i) => [i.platform, i.netPaise])).toEqual([
      ["swiggy", 4600],
      ["swiggy", 5000], // netPayout wins over gross
      ["zepto", -500], // penalty adjustment, negative (UX E4)
      ["zepto", 3100],
    ]);
    db.close();
  });

  it("filters by platform and excludes superseded revisions", async () => {
    const { db, rawId } = await seededDb();
    await db.transaction((tx) =>
      writeEarning(tx, earning({ grossAmount: 3800, externalId: "S-2" }), rawId),
    );
    const items = await listEarnings(db, { platform: "swiggy", limit: 50 });
    expect(items.map((i) => i.netPaise).sort((a, b) => a - b)).toEqual([3800, 5000]);
    db.close();
  });
});
