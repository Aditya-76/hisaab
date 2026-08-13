import type { Earning } from "@hisaab/core";
import { describe, expect, it } from "vitest";
import { openNodeDb } from "../testing/node-db.js";
import { migrate } from "./migrations.js";
import { writeEarning } from "./normalized.js";
import { insertRawEvent } from "./raw-events.js";

const order = (over: Partial<Earning> = {}): Earning => ({
  type: "earning",
  platform: "swiggy",
  timestamp: "2026-08-12T19:42:00+05:30",
  kind: "order",
  grossAmount: 4200,
  externalId: "ORD-1",
  ...over,
});

async function seededDb() {
  const db = openNodeDb();
  await migrate(db);
  const rawId = await insertRawEvent(db, {
    source: "notification",
    packageName: "in.swiggy.deliveryapp",
    text: "You earned ₹42 for this order.",
    postedAt: "2026-08-12T19:42:00+05:30",
    capturedAt: "2026-08-12T19:42:01+05:30",
  });
  return { db, rawId };
}

describe("writeEarning dedupe + supersedence (UX E1/E3)", () => {
  it("inserts with the IST day precomputed", async () => {
    const { db, rawId } = await seededDb();
    const res = await db.transaction((tx) => writeEarning(tx, order(), rawId));
    expect(res.action).toBe("inserted");
    const { rows } = await db.execute("SELECT day, gross_amount, superseded_by FROM earnings");
    expect(rows).toEqual([{ day: "2026-08-12", gross_amount: 4200, superseded_by: null }]);
    db.close();
  });

  it("an identical re-notification is a duplicate, not a second row", async () => {
    const { db, rawId } = await seededDb();
    const first = await db.transaction((tx) => writeEarning(tx, order(), rawId));
    const again = await db.transaction((tx) => writeEarning(tx, order(), rawId));
    expect(again).toEqual({ action: "duplicate", id: first.id });
    const { rows } = await db.execute("SELECT COUNT(*) AS n FROM earnings");
    expect(rows[0]?.n).toBe(1);
    db.close();
  });

  it("a revised amount supersedes: old row kept, excluded from current view", async () => {
    const { db, rawId } = await seededDb();
    const first = await db.transaction((tx) => writeEarning(tx, order(), rawId));
    const revised = await db.transaction((tx) =>
      writeEarning(tx, order({ grossAmount: 3800 }), rawId),
    );
    expect(revised.action).toBe("superseded");

    const { rows } = await db.execute(
      "SELECT id, gross_amount, superseded_by FROM earnings ORDER BY id",
    );
    expect(rows).toEqual([
      { id: first.id, gross_amount: 4200, superseded_by: revised.id },
      { id: revised.id, gross_amount: 3800, superseded_by: null },
    ]);

    // Current-rows view (what aggregation queries) sees only the revision.
    const current = await db.execute(
      "SELECT gross_amount FROM earnings WHERE superseded_by IS NULL",
    );
    expect(current.rows).toEqual([{ gross_amount: 3800 }]);
    db.close();
  });

  it("the partial unique index rejects a second current row per (platform, external_id)", async () => {
    const { db, rawId } = await seededDb();
    await db.transaction((tx) => writeEarning(tx, order(), rawId));
    await expect(
      db.execute(
        `INSERT INTO earnings (raw_event_id, platform, kind, gross_amount, external_id, occurred_at, day)
         VALUES (?, 'swiggy', 'order', 100, 'ORD-1', '2026-08-12T20:00:00+05:30', '2026-08-12')`,
        [rawId],
      ),
    ).rejects.toThrow(/UNIQUE/i);
    db.close();
  });

  it("earnings without external_id never dedupe against each other", async () => {
    const { db, rawId } = await seededDb();
    const { externalId: _drop, ...noId } = order();
    const a = await db.transaction((tx) => writeEarning(tx, noId, rawId));
    const b = await db.transaction((tx) => writeEarning(tx, noId, rawId));
    expect(a.action).toBe("inserted");
    expect(b.action).toBe("inserted");
    expect(a.id).not.toBe(b.id);
    db.close();
  });
});
