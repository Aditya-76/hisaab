import { z } from "zod";
import { IsoTimestampSchema, NonNegativePaiseSchema, PlatformSchema } from "./common.js";

/**
 * A platform's *claim* about incentive/payout money — promised, and later
 * (maybe) credited. Money actually observed on the payment rails is a
 * `PayoutCredit`, never this (docs/DECISIONS.md D-021).
 */
export const IncentiveEventSchema = z.object({
  type: z.literal("incentive"),
  platform: PlatformSchema,
  timestamp: IsoTimestampSchema,
  /** Integer paise the platform said the worker would/does get. */
  promisedAmount: NonNegativePaiseSchema,
  /** Set when the platform announces the money as credited. */
  creditedAmount: NonNegativePaiseSchema.optional(),
  /** The platform's own wording of the criteria/cycle, verbatim. */
  criteriaText: z.string(),
});
export type IncentiveEvent = z.infer<typeof IncentiveEventSchema>;
