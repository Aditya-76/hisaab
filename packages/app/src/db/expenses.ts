import { assertPaise, type Expense, istDayKey } from "@hisaab/core";
import type { DbExecutor } from "./db.js";

/**
 * Expense entry (F4, UX §3.3): the one manual-input feature. Amounts arrive
 * as integer paise — the sheet converts keypad text via core's
 * parseInrToPaise, so no float ever touches this path.
 */

export interface ExpenseListItem {
  id: number;
  category: Expense["category"];
  amountPaise: number;
  occurredAt: string;
  note: string | null;
}

export async function addExpense(db: DbExecutor, expense: Expense): Promise<number> {
  const { rows } = await db.execute(
    `INSERT INTO expenses (category, amount, occurred_at, day, note)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id`,
    [
      expense.category,
      assertPaise(expense.amount),
      expense.timestamp,
      istDayKey(expense.timestamp),
      expense.note ?? null,
    ],
  );
  return rows[0]?.id as number;
}

export async function listExpenses(db: DbExecutor, day: string): Promise<ExpenseListItem[]> {
  const { rows } = await db.execute(
    `SELECT id, category, amount, occurred_at, note
     FROM expenses WHERE day = ? ORDER BY occurred_at DESC`,
    [day],
  );
  return rows.map((row) => ({
    id: row.id as number,
    category: String(row.category) as Expense["category"],
    amountPaise: row.amount as number,
    occurredAt: String(row.occurred_at),
    note: row.note != null ? String(row.note) : null,
  }));
}

export async function deleteExpense(db: DbExecutor, id: number): Promise<void> {
  await db.execute("DELETE FROM expenses WHERE id = ?", [id]);
}

/**
 * Most recently used distinct amounts, for the keypad shortcut chips
 * ("Recent: ₹100 ₹150 ₹200", UX §3.3).
 */
export async function recentExpenseAmounts(db: DbExecutor, limit: number): Promise<number[]> {
  const { rows } = await db.execute(
    "SELECT amount FROM expenses GROUP BY amount ORDER BY MAX(id) DESC LIMIT ?",
    [limit],
  );
  return rows.map((row) => row.amount as number);
}
