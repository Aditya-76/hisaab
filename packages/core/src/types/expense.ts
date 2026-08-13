import { z } from "zod";
import { IsoTimestampSchema, NonNegativePaiseSchema } from "./common.js";

export const EXPENSE_CATEGORIES = ["fuel", "recharge", "rent", "other"] as const;

/** Manually-entered cost (F4). The only data entry hisaab ever asks for. */
export const ExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  /** Integer paise. */
  amount: NonNegativePaiseSchema,
  timestamp: IsoTimestampSchema,
  note: z.string().optional(),
});
export type Expense = z.infer<typeof ExpenseSchema>;
