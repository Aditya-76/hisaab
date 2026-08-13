import { z } from "zod";
import { IsoTimestampSchema } from "./common.js";

/**
 * The single input shape every parser receives (docs/TECH-DESIGN.md §3).
 * Parsers are pure: everything they may look at arrives here — no clocks,
 * no locale, no I/O.
 */
export const RawInputSchema = z.object({
  source: z.enum(["notification", "sms"]),
  /** Notifications: Android package name, e.g. "in.swiggy.deliveryapp". */
  packageName: z.string().optional(),
  /** SMS: DLT sender header, e.g. "VM-HDFCBK". */
  sender: z.string().optional(),
  title: z.string().optional(),
  /** Notification text/bigText or SMS body. */
  text: z.string(),
  /** From notification postTime / SMS date — ISO 8601 with offset. */
  postedAt: IsoTimestampSchema,
  /** Platform app versionName when resolvable. */
  appVersion: z.string().optional(),
});
export type RawInput = z.infer<typeof RawInputSchema>;
