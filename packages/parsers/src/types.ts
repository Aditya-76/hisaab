import type { NormalizedEvent, RawInput } from "@hisaab/core";

/**
 * The parser contract (docs/TECH-DESIGN.md §3): a pure function — no I/O,
 * no Date.now(), no locale access. Returns null when the input is not the
 * notification type this parser understands.
 */
export type Parser = (input: RawInput) => NormalizedEvent | null;

/** A parser with a stable id ("swiggy/order-delivered") for diagnostics. */
export interface NamedParser {
  id: string;
  parse: Parser;
}

/**
 * What the registry says about one raw input.
 *
 * - `parsed`   — a parser produced a (Zod-validated) normalized event.
 * - `ignored`  — from an allowlisted app/sender, but a known no-earnings
 *                type (marketing, OTPs…). Excluded from the coverage
 *                denominator; the ignore list is fixture-tested so it can
 *                never become a coverage-inflating dumping ground
 *                (docs/INSTRUMENTATION.md §3).
 * - `unparsed` — nothing understood it. Never dropped: the app keeps the raw
 *                event in the unparsed queue (PRD principle 6).
 */
export type ParseResult =
  | { status: "parsed"; event: NormalizedEvent; parserId: string; parserPackVersion: string }
  | { status: "ignored"; platform: string }
  | { status: "unparsed"; platformGuess?: string };

/** One platform's routing + parsing configuration. */
export interface RegistryEntry {
  platform: string;
  /** Android package names this entry handles (notifications). */
  packageNames?: readonly string[];
  /** SMS sender (DLT header) patterns this entry handles. */
  senderPatterns?: readonly RegExp[];
  /** Ordered — first non-null result wins. */
  parsers: readonly NamedParser[];
  /**
   * Known no-earnings chatter. Checked only AFTER every parser returned null,
   * so an earnings notification can never be swallowed by the ignore list.
   */
  ignore: (input: RawInput) => boolean;
}
