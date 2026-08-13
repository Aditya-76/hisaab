import { PARSER_PACK_VERSION } from "@hisaab/parsers";
import { describe, expect, it } from "vitest";
import { migrate } from "../db/migrations.js";
import { countUnparsed, insertRawEvent, listUnparsed } from "../db/raw-events.js";
import { PARSED_STATE } from "../db/schema.js";
import { openNodeDb } from "../testing/node-db.js";
import { drainRawEvents } from "./drainer.js";

const T = "2026-08-12T19:42:00+05:30";

async function freshDb() {
  const db = openNodeDb();
  await migrate(db);
  return db;
}

function swiggyOrder(text: string, postedAt = T) {
  return {
    source: "notification" as const,
    packageName: "in.swiggy.deliveryapp",
    title: "Order delivered!",
    text,
    postedAt,
    capturedAt: postedAt,
  };
}

describe("drainRawEvents", () => {
  it("routes parsed / ignored / unparsed rows and never deletes anything", async () => {
    const db = await freshDb();
    await insertRawEvent(db, swiggyOrder("You earned ₹42 for this order."));
    await insertRawEvent(db, {
      source: "sms",
      sender: "VM-HDFCBK",
      text: "Rs.245.00 credited to a/c XX1234 on 12-08-26 by VPA swiggy-payouts@axisbank (SWIGGY). UPI Ref No 520912345678.",
      postedAt: T,
      capturedAt: T,
    });
    await insertRawEvent(db, {
      ...swiggyOrder("Get a new raincoat at 50% discount from the gear store."),
      title: "Monsoon offer!",
    });
    await insertRawEvent(db, {
      ...swiggyOrder("Your Tuesday summary is ready. Tap to view."),
      title: "Your summary",
    });
    await insertRawEvent(db, {
      source: "notification",
      packageName: "com.example.unknownapp",
      text: "Something entirely unrelated",
      postedAt: T,
      capturedAt: T,
    });

    const result = await drainRawEvents(db);
    expect(result).toMatchObject({
      scanned: 5,
      parsed: 2,
      ignored: 1,
      unparsed: 2,
      errors: 0,
    });

    const earnings = await db.execute("SELECT platform, gross_amount, day FROM earnings");
    expect(earnings.rows).toEqual([{ platform: "swiggy", gross_amount: 4200, day: "2026-08-12" }]);
    const payouts = await db.execute("SELECT source, amount, match_status FROM payout_credits");
    expect(payouts.rows).toEqual([{ source: "upi", amount: 24500, match_status: "unmatched" }]);

    // Nothing dropped: all five raw rows still there, states stamped.
    const raw = await db.execute("SELECT parsed, parser_pack_version FROM raw_events ORDER BY id");
    expect(raw.rows.map((r) => r.parsed)).toEqual([
      PARSED_STATE.parsed,
      PARSED_STATE.parsed,
      PARSED_STATE.ignored,
      PARSED_STATE.unparsed,
      PARSED_STATE.unparsed,
    ]);
    for (const row of raw.rows) expect(row.parser_pack_version).toBe(PARSER_PACK_VERSION);

    expect(await countUnparsed(db)).toBe(2);
    db.close();
  });

  it("converges: a second drain scans nothing until the parser pack changes", async () => {
    const db = await freshDb();
    await insertRawEvent(db, swiggyOrder("Your Tuesday summary is ready. Tap to view."));
    expect((await drainRawEvents(db)).scanned).toBe(1);
    expect((await drainRawEvents(db)).scanned).toBe(0);

    // New parser pack → the unparsed backlog re-qualifies (TECH-DESIGN §3).
    const again = await drainRawEvents(db, { parserPackVersion: "999.0.0-test" });
    expect(again.scanned).toBe(1);
    expect(again.unparsed).toBe(1);
    db.close();
  });

  it("drains in multiple batches", async () => {
    const db = await freshDb();
    for (let i = 0; i < 5; i++) {
      await insertRawEvent(db, swiggyOrder(`You earned ₹${10 + i} for this order.`, T));
    }
    const result = await drainRawEvents(db, { batchSize: 2 });
    expect(result.scanned).toBe(5);
    expect(result.parsed).toBe(5);
    const { rows } = await db.execute("SELECT COUNT(*) AS n FROM earnings");
    expect(rows[0]?.n).toBe(5);
    db.close();
  });

  it("a malformed stored row becomes parse_error, not a crash", async () => {
    const db = await freshDb();
    // Bad posted_at: the parser emits an invalid timestamp, Zod rejects it,
    // the registry reports unparsed — the row must be stamped, not retried
    // forever, and everything else must still drain.
    await insertRawEvent(db, swiggyOrder("You earned ₹42 for this order.", "not-a-timestamp"));
    await insertRawEvent(db, swiggyOrder("You earned ₹11 for this order."));
    const result = await drainRawEvents(db);
    expect(result.scanned).toBe(2);
    expect(result.parsed).toBe(1);
    expect(result.unparsed + result.errors).toBe(1);
    expect((await drainRawEvents(db)).scanned).toBe(0);
    db.close();
  });

  it("listUnparsed feeds the inbox stub, newest first", async () => {
    const db = await freshDb();
    await insertRawEvent(db, swiggyOrder("Mystery one", "2026-08-12T10:00:00+05:30"));
    await insertRawEvent(db, swiggyOrder("Mystery two", "2026-08-12T11:00:00+05:30"));
    await drainRawEvents(db);
    const items = await listUnparsed(db, 10);
    expect(items.map((i) => i.text)).toEqual(["Mystery two", "Mystery one"]);
    expect(items[0]?.platformHint).toBe("in.swiggy.deliveryapp");
    db.close();
  });
});
