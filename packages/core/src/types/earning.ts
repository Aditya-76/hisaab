import { z } from "zod";
import {
  IsoTimestampSchema,
  NonNegativePaiseSchema,
  PaiseSchema,
  PlatformSchema,
} from "./common.js";

export const EARNING_KINDS = ["order", "trip", "job", "shift", "adjustment"] as const;

/**
 * One unit of earned money. Delivery orders, rides, and jobs all map here via
 * `kind` (docs/DECISIONS.md D-013). Penalties/deductions are negative-amount
 * `kind: "adjustment"` earnings so daily nets stay correct (UX E4).
 */
export const EarningSchema = z
  .object({
    type: z.literal("earning"),
    platform: PlatformSchema,
    timestamp: IsoTimestampSchema,
    kind: z.enum(EARNING_KINDS),
    /** Integer paise. Includes tips/surge when the platform reports one total. */
    grossAmount: PaiseSchema,
    tips: NonNegativePaiseSchema.optional(),
    surge: NonNegativePaiseSchema.optional(),
    /** Platform-stated take-home for this earning, when shown separately. */
    netPayout: PaiseSchema.optional(),
    distanceKm: z.number().nonnegative().optional(),
    /** Platform's own order/trip id — dedupe + revision key (UX E1/E3). */
    externalId: z.string().optional(),
  })
  .refine((e) => e.kind === "adjustment" || e.grossAmount >= 0, {
    message: "grossAmount may be negative only for kind 'adjustment'",
  });
export type Earning = z.infer<typeof EarningSchema>;
