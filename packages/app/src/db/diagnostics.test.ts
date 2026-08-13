import { describe, expect, it } from "vitest";
import { openNodeDb } from "../testing/node-db.js";
import {
  captureCounts,
  coverageByPlatform,
  logDiagnostic,
  pruneDiagnostics,
} from "./diagnostics.js";
import { migrate } from "./migrations.js";
import { insertRawEvent } from "./raw-events.js";
import { CAPTURE_MARKER_PACKAGE, PARSED_STATE } from "./schema.js";

const PACKAGE_TO_PLATFORM = new Map([
  ["in.swiggy.deliveryapp", "swiggy"],
  ["com.zepto.rider", "zepto"],
]);

async function seed(db: Awaited<ReturnType<typeof freshDb>>) {
  let n = 0;
  const raw = async (packageName: string | undefined, parsed: number, source = "notification") => {
    n += 1;
    const id = await insertRawEvent(db, {
      source: source as "notification" | "sms",
      ...(packageName !== undefined ? { packageName } : {}),
      ...(source === "sms" ? { sender: "AX-HDFCBK" } : {}),
      text: `event ${n}`,
      postedAt: "2026-08-12T10:00:00+05:30",
      capturedAt: "2026-08-12T10:00:01+05:30",
    });
    await db.execute("UPDATE raw_events SET parsed = ? WHERE id = ?", [parsed, id]);
  };

  // swiggy: 3 parsed, 1 unparsed, 1 ignored (ignored excluded from metric)
  await raw("in.swiggy.deliveryapp", PARSED_STATE.parsed);
  await raw("in.swiggy.deliveryapp", PARSED_STATE.parsed);
  await raw("in.swiggy.deliveryapp", PARSED_STATE.parsed);
  await raw("in.swiggy.deliveryapp", PARSED_STATE.unparsed);
  await raw("in.swiggy.deliveryapp", PARSED_STATE.ignored);
  // zepto: 1 parse_error only → coverage null (no parsed/unparsed signal)
  await raw("com.zepto.rider", PARSED_STATE.parse_error);
  // unknown package: 1 unparsed
  await raw("com.random.app", PARSED_STATE.unparsed);
  // sms: 1 parsed
  await raw(undefined, PARSED_STATE.parsed, "sms");
  // gap marker (D-025): excluded everywhere except the gapMarkers count
  await raw(CAPTURE_MARKER_PACKAGE, PARSED_STATE.ignored);
}

async function freshDb() {
  const db = openNodeDb();
  await migrate(db);
  return db;
}

describe("coverageByPlatform (INSTRUMENTATION §3)", () => {
  it("computes parsed/(parsed+unparsed) per platform, ignoring 'ignored' rows", async () => {
    const db = await freshDb();
    await seed(db);
    expect(await coverageByPlatform(db, PACKAGE_TO_PLATFORM)).toEqual([
      { platform: "swiggy", parsed: 3, unparsed: 1, errors: 0, coverage: 0.75 },
      { platform: "unknown", parsed: 0, unparsed: 1, errors: 0, coverage: 0 },
      { platform: "upi-sms", parsed: 1, unparsed: 0, errors: 0, coverage: 1 },
      { platform: "zepto", parsed: 0, unparsed: 0, errors: 1, coverage: null },
    ]);
    db.close();
  });
});

describe("captureCounts", () => {
  it("splits totals by parse state and counts gap markers separately", async () => {
    const db = await freshDb();
    await seed(db);
    expect(await captureCounts(db)).toEqual({
      captured: 8,
      parsed: 4,
      unparsed: 2,
      ignored: 1,
      errors: 1,
      gapMarkers: 1,
    });
    db.close();
  });
});

describe("diagnostics_log", () => {
  it("logs events with JSON props and prunes by cutoff", async () => {
    const db = await freshDb();
    await logDiagnostic(db, "app.open", "2026-02-01T09:00:00+05:30");
    await logDiagnostic(db, "expense.added", "2026-08-12T18:05:00+05:30", { category: "fuel" });

    const pruned = await pruneDiagnostics(db, "2026-08-01T00:00:00+05:30");
    expect(pruned).toBe(1);
    const { rows } = await db.execute("SELECT event, props FROM diagnostics_log");
    expect(rows).toEqual([{ event: "expense.added", props: '{"category":"fuel"}' }]);
    db.close();
  });
});
