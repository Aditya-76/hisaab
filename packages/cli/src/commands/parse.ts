import { readFileSync } from "node:fs";
import { RawInputSchema } from "@hisaab/core";
import { parseRawInput } from "@hisaab/parsers";

/**
 * `hisaab-cli parse <file|->` — the parser author's debugging loop.
 * Reads one RawInput JSON (or stdin with "-"), prints the full ParseResult.
 * Exit codes: 0 parsed/ignored · 2 unparsed · 1 error.
 */
export function parseCommand(target: string, opts: { compact: boolean }): number {
  const raw = target === "-" ? readFileSync(0, "utf8") : readFileSync(target, "utf8");
  const input = RawInputSchema.parse(JSON.parse(raw));
  const result = parseRawInput(input);
  console.log(opts.compact ? JSON.stringify(result) : JSON.stringify(result, null, 2));
  return result.status === "unparsed" ? 2 : 0;
}
