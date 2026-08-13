import { z } from "zod";
import { IsoTimestampSchema } from "./common.js";

export const PARSED_STATES = ["unparsed", "parsed", "parse_error", "ignored"] as const;

/**
 * A captured raw notification/SMS as the app stores it (raw_events table,
 * docs/TECH-DESIGN.md §4). Defined now so Phase 2 (capture pipeline) and the
 * CLI replay path share one shape. Raw events persist BEFORE parsing — parse
 * failures lose nothing.
 */
export const RawEventSchema = z.object({
  source: z.enum(["notification", "sms"]),
  platformGuess: z.string().optional(),
  title: z.string().optional(),
  rawText: z.string(),
  postedAt: IsoTimestampSchema,
  capturedAt: IsoTimestampSchema,
  parsedState: z.enum(PARSED_STATES),
  parserPackVersion: z.string().optional(),
  contributed: z.boolean(),
  dedupeKey: z.string().optional(),
});
export type RawEvent = z.infer<typeof RawEventSchema>;
