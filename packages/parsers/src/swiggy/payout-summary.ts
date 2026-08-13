import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { fullText } from "../common/text.js";

/**
 * Weekly payout announcement — the platform's CLAIM that money was sent.
 * Modeled as an IncentiveEvent (promised+credited); money actually observed
 * on the rails is the bank/UPI SMS PayoutCredit (docs/DECISIONS.md D-021) —
 * reconciliation compares the two.
 *
 *   EN: "Weekly payout of ₹4,560 processed to your bank account."
 *   HI: "₹4,560 का weekly payout आपके bank में भेज दिया गया है।"
 */
const PAYOUT_RES: readonly RegExp[] = [
  new RegExp(`payout\\s+of\\s+${INR}`, "i"),
  new RegExp(`${INR}\\s*(?:का|ka)\\s*(?:weekly\\s*)?payout`, "iu"),
  new RegExp(`${INR}\\s*ಪಾವತಿ`, "u"),
];

const PAYOUT_CONTEXT_RE = /payout|processed|transferred|भेज दिया|ಪಾವತಿ|वीकली|weekly/iu;

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
          platform: "swiggy",
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
