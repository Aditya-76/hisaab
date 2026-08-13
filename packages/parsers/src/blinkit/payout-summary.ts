import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { fullText } from "../common/text.js";

/**
 * Weekly payout announcement — the platform's claim, modeled as an
 * IncentiveEvent (docs/DECISIONS.md D-021).
 *
 *   EN: "Weekly payout of ₹3,780 sent to your bank account."
 */
const PAYOUT_RES: readonly RegExp[] = [
  new RegExp(`payout\\s+of\\s+${INR}`, "i"),
  new RegExp(`${INR}\\s*(?:का|ka)\\s*(?:weekly\\s*)?payout`, "iu"),
];

const PAYOUT_CONTEXT_RE = /payout|sent to your bank|transferred|processed|weekly/iu;

export function parsePayoutSummary(input: RawInput): NormalizedEvent | null {
  const text = fullText(input.title, input.text);
  if (!PAYOUT_CONTEXT_RE.test(text)) return null;

  for (const re of PAYOUT_RES) {
    const m = re.exec(text);
    if (m) {
      const amount = capturedPaise(m[1]);
      if (amount !== null && amount > 0) {
        return {
          type: "incentive",
          platform: "blinkit",
          timestamp: input.postedAt,
          promisedAmount: amount,
          creditedAmount: amount,
          criteriaText: text,
        };
      }
    }
  }
  return null;
}
