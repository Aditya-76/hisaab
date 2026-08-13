import { describe, expect, it } from "vitest";
import { openNodeDb } from "../testing/node-db.js";
import { migrate } from "./migrations.js";
import { getSetting, SETTING_KEYS, setSetting } from "./settings.js";

describe("settings repo (D-027)", () => {
  it("returns null for an unset key — callers must have a default", async () => {
    const db = openNodeDb();
    await migrate(db);
    expect(await getSetting(db, SETTING_KEYS.language)).toBeNull();
    db.close();
  });

  it("sets and overwrites", async () => {
    const db = openNodeDb();
    await migrate(db);
    await setSetting(db, SETTING_KEYS.language, "kn");
    expect(await getSetting(db, SETTING_KEYS.language)).toBe("kn");
    await setSetting(db, SETTING_KEYS.language, "hi");
    expect(await getSetting(db, SETTING_KEYS.language)).toBe("hi");
    db.close();
  });
});
