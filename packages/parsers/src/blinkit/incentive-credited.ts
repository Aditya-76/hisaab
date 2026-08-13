import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { fullText } from "../common/text.js";

/**
 * Incentive credited — promised AND credited.
 *
 *   EN: "Surge bonus! ₹90 added to today's earnings."
 */
const CREDITED_RES: readonly RegExp[] = [
  new RegExp(`${INR}\\s*(?:bonus\\s+)?(?:added|credited)`, "i"),
  new RegExp(`bonus\\s+of\\s+${INR}`, "i"),
  new RegExp(`${INR}\\s*ಸೇರಿಸಲಾಗಿದೆ`, "u"),
];

const INCENTIVE_CONTEXT_RE = /incentive|bonus|surge|इंसेंटिव|बोनस|ಬೋನಸ್/iu;

export function parseIncentiveCredited(input: RawInput): NormalizedEvent | null {
  const text = fullText(input.title, input.text);
  if (!INCENTIVE_CONTEXT_RE.test(text)) return null;

  for (const re of CREDITED_RES) {
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
