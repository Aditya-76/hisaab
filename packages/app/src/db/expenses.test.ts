import type { Expense } from "@hisaab/core";
import { describe, expect, it } from "vitest";
import { openNodeDb } from "../testing/node-db.js";
import { addExpense, deleteExpense, listExpenses, recentExpenseAmounts } from "./expenses.js";
import { migrate } from "./migrations.js";

const fuel = (over: Partial<Expense> = {}): Expense => ({
  category: "fuel",
  amount: 15000,
  timestamp: "2026-08-12T18:00:00+05:30",
  ...over,
});

async function freshDb() {
  const db = openNodeDb();
  await migrate(db);
  return db;
}

describe("expenses repo (F4)", () => {
  it("stores with the IST day precomputed and lists newest first", async () => {
    const db = await freshDb();
    await addExpense(db, fuel({ note: "morning tank" }));
    await addExpense(
      db,
      fuel({ category: "recharge", amount: 2000, timestamp: "2026-08-12T21:00:00+05:30" }),
    );
    // A post-midnight IST expense belongs to the next day (UX E5).
    await addExpense(db, fuel({ timestamp: "2026-08-12T19:00:00.000Z" })); // 00:30 IST Aug 13

    const day12 = await listExpenses(db, "2026-08-12");
    expect(day12.map((x) => [x.category, x.amountPaise, x.note])).toEqual([
      ["recharge", 2000, null],
      ["fuel", 15000, "morning tank"],
    ]);
    expect(await listExpenses(db, "2026-08-13")).toHaveLength(1);
    db.close();
  });

  it("rejects non-integer paise (money path guard)", async () => {
    const db = await freshDb();
    await expect(addExpense(db, fuel({ amount: 150.5 }))).rejects.toThrow(/integer paise/);
    db.close();
  });

  it("recent amounts are distinct, most-recent first (keypad chips)", async () => {
    const db = await freshDb();
    for (const amount of [10000, 15000, 10000, 20000]) {
      await addExpense(db, fuel({ amount }));
    }
    expect(await recentExpenseAmounts(db, 3)).toEqual([20000, 10000, 15000]);
    db.close();
  });

  it("deletes by id", async () => {
    const db = await freshDb();
    const id = await addExpense(db, fuel());
    await deleteExpense(db, id);
    expect(await listExpenses(db, "2026-08-12")).toEqual([]);
    db.close();
  });
});
