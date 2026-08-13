import { z } from "zod";

/**
 * Money is ALWAYS integer paise (1 rupee = 100 paise). Never floats in money
 * paths (docs/TECH-DESIGN.md §4).
 */
export const PaiseSchema = z.number().int();
export type Paise = z.infer<typeof PaiseSchema>;

export const NonNegativePaiseSchema = PaiseSchema.nonnegative();

/** ISO 8601 timestamp carrying an explicit offset (or Z). */
export const IsoTimestampSchema = z.iso.datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

/**
 * Platform identifier. Wave-1 values are listed for reference; the schema is
 * an open string so later platform waves are parser work, not schema work
 * (docs/DECISIONS.md D-013).
 */
export const WAVE1_PLATFORMS = ["swiggy", "zomato", "blinkit", "zepto", "upi-sms"] as const;
export const PlatformSchema = z.string().min(1);
export type Platform = z.infer<typeof PlatformSchema>;
