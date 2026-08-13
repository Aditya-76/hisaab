import { NormalizedEventSchema, type RawInput } from "@hisaab/core";
import { blinkitEntry } from "./blinkit/index.js";
import { swiggyEntry } from "./swiggy/index.js";
import type { ParseResult, RegistryEntry } from "./types.js";
import { upiSmsEntry } from "./upi-sms/index.js";
import { PARSER_PACK_VERSION } from "./version.js";
import { zeptoEntry } from "./zepto/index.js";
import { zomatoEntry } from "./zomato/index.js";

/** All platform knowledge lives here (docs/CLAUDE.md architecture principles). */
export const REGISTRY: readonly RegistryEntry[] = [
  upiSmsEntry,
  swiggyEntry,
  zomatoEntry,
  blinkitEntry,
  zeptoEntry,
];

function findEntry(input: RawInput): RegistryEntry | undefined {
  if (input.source === "notification") {
    if (!input.packageName) return undefined;
    return REGISTRY.find((e) => e.packageNames?.includes(input.packageName as string));
  }
  if (!input.sender) return undefined;
  return REGISTRY.find((e) => e.senderPatterns?.some((p) => p.test(input.sender as string)));
}

/**
 * Route a raw input to its platform entry and run its parsers in order —
 * first non-null wins. Unknown package/sender → unparsed with no guess.
 * A parser throwing or emitting an invalid shape never crashes the caller
 * (UX §5.3): the input simply stays unparsed.
 */
export function parseRawInput(input: RawInput): ParseResult {
  const entry = findEntry(input);
  if (!entry) return { status: "unparsed" };

  for (const parser of entry.parsers) {
    let event: unknown;
    try {
      event = parser.parse(input);
    } catch {
      continue;
    }
    if (event === null || event === undefined) continue;
    const checked = NormalizedEventSchema.safeParse(event);
    if (!checked.success) continue; // invalid parser output is a parser bug, not lost data
    return {
      status: "parsed",
      event: checked.data,
      parserId: parser.id,
      parserPackVersion: PARSER_PACK_VERSION,
    };
  }

  if (entry.ignore(input)) return { status: "ignored", platform: entry.platform };
  return { status: "unparsed", platformGuess: entry.platform };
}
