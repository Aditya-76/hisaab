import { describe, expect, it } from "vitest";
import { openNodeDb } from "../testing/node-db.js";
import { currentSchemaVersion, MIGRATIONS, type Migration, migrate } from "./migrations.js";
import { RAW_EVENTS_SQL, statementsOf } from "./schema.js";

describe("migrations", () => {
  it("brings a fresh DB to the latest version with all tables", async () => {
    const db = openNodeDb();
    const version = await migrate(db);
    expect(version).toBe(MIGRATIONS[MIGRATIONS.length - 1]?.version);
    expect(await currentSchemaVersion(db)).toBe(version);

    const { rows } = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const tables = rows.map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "raw_events",
        "earnings",
        "incentive_events",
        "payout_credits",
        "payout_matches",
        "expenses",
        "diagnostics_log",
        "settings",
      ]),
    );
    db.close();
  });

  it("upgrades a v1 database in place (migration 002 adds settings)", async () => {
    const db = openNodeDb();
    await migrate(db, MIGRATIONS.slice(0, 1));
    expect(await currentSchemaVersion(db)).toBe(1);

    await migrate(db);
    const { rows } = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
    );
    expect(rows).toEqual([{ name: "settings" }]);
    db.close();
  });

  it("is idempotent — running twice is a no-op", async () => {
    const db = openNodeDb();
    await migrate(db);
    await expect(migrate(db)).resolves.toBe(MIGRATIONS[MIGRATIONS.length - 1]?.version);
    db.close();
  });

  it("migrates a DB the native capture module bootstrapped first (D-024)", async () => {
    const db = openNodeDb();
    // Simulate Kotlin RawEventStore: raw_events exists, user_version still 0.
    for (const stmt of statementsOf(RAW_EVENTS_SQL)) await db.execute(stmt);
    await db.execute(
      `INSERT INTO raw_events (source, package_name, title, text, posted_at, captured_at)
       VALUES ('notification', 'in.swiggy.deliveryapp', 'Order delivered', 'You earned Rs.54', '2026-08-10T12:00:00+05:30', '2026-08-10T12:00:01+05:30')`,
    );

    await migrate(db);
    // The pre-migration capture survived untouched.
    const { rows } = await db.execute("SELECT text, parsed FROM raw_events");
    expect(rows).toEqual([{ text: "You earned Rs.54", parsed: 0 }]);
    db.close();
  });

  it("versions are contiguous from 1", () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });

  it("a failing migration rolls back and keeps the previous version", async () => {
    const db = openNodeDb();
    await migrate(db);
    const bad: Migration = {
      version: MIGRATIONS.length + 1,
      description: "explodes halfway",
      async up(tx) {
        await tx.execute("CREATE TABLE half_done (id INTEGER PRIMARY KEY)");
        throw new Error("boom");
      },
    };
    await expect(migrate(db, [...MIGRATIONS, bad])).rejects.toThrow("boom");
    expect(await currentSchemaVersion(db)).toBe(MIGRATIONS.length);
    const { rows } = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'half_done'",
    );
    expect(rows).toEqual([]);
    db.close();
  });
});
