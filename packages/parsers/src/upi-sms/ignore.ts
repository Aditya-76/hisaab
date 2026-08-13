import type { RawInput } from "@hisaab/core";
import { normalizeText } from "../common/text.js";

/**
 * Known no-earnings SMS from allowlisted bank senders. Checked only after
 * every credit parser returned null, so a genuine credit can never land here.
 * Fixture-tested (docs/INSTRUMENTATION.md §3).
 */
const IGNORE_RES: readonly RegExp[] = [
  /debited|debit\b/i,
  /\bOTP\b|one[- ]time password/i,
  /avl(?:\.|bl)?\s*bal(?:ance)?|available balance|bal(?:ance)? (?:in|of) your/i,
  /statement|e-?statement/i,
  /EMI (?:due|payment)|loan (?:offer|approved)/i,
  /offer|cashback on|reward point|win\b|congratulations/i,
  /KYC|kindly update/i,
  /requested money|collect request|payment request/i,
];

export function ignoreUpiSms(input: RawInput): boolean {
  const text = normalizeText(input.text);
  return IGNORE_RES.some((re) => re.test(text));
}
