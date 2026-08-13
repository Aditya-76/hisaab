import { z } from "zod";
import { IsoTimestampSchema, PaiseSchema } from "./common.js";

/**
 * Money actually observed arriving on the payment rails (bank/UPI credit SMS).
 * Match status against platform payout cycles lives in the app's DB layer,
 * not here (docs/TECH-DESIGN.md §4, §7).
 */
export const PayoutCreditSchema = z.object({
  type: z.literal("payout"),
  source: z.enum(["upi", "bank", "wallet"]),
  /** Integer paise credited. */
  amount: PaiseSchema.positive(),
  timestamp: IsoTimestampSchema,
  /**
   * Payer narration/name fragment from the message (e.g. "SWIGGY", a VPA
   * handle) — reconciliation's strongest matching signal (TECH-DESIGN §7).
   */
  narration: z.string().optional(),
  /** Bank-masked account hint exactly as the bank printed it, e.g. "XX1234". */
  accountHint: z.string().optional(),
});
export type PayoutCredit = z.infer<typeof PayoutCreditSchema>;
