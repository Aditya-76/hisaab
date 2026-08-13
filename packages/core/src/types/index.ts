import { z } from "zod";
import { EarningSchema } from "./earning.js";
import { IncentiveEventSchema } from "./incentive.js";
import { PayoutCreditSchema } from "./payout.js";

export type { IsoTimestamp, Paise, Platform } from "./common.js";
export {
  IsoTimestampSchema,
  NonNegativePaiseSchema,
  PaiseSchema,
  PlatformSchema,
  WAVE1_PLATFORMS,
} from "./common.js";
export type { Earning } from "./earning.js";
export { EARNING_KINDS, EarningSchema } from "./earning.js";
export type { Expense } from "./expense.js";
export { EXPENSE_CATEGORIES, ExpenseSchema } from "./expense.js";
export type { IncentiveEvent } from "./incentive.js";
export { IncentiveEventSchema } from "./incentive.js";
export type { PayoutCredit } from "./payout.js";
export { PayoutCreditSchema } from "./payout.js";
export type { RawEvent } from "./raw-event.js";
export { PARSED_STATES, RawEventSchema } from "./raw-event.js";
export type { RawInput } from "./raw-input.js";
export { RawInputSchema } from "./raw-input.js";

/**
 * What a parser may produce: one of the three normalized event shapes,
 * discriminated by the literal `type` field.
 */
export const NormalizedEventSchema = z.discriminatedUnion("type", [
  EarningSchema,
  IncentiveEventSchema,
  PayoutCreditSchema,
]);
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;
