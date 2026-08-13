import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { fullText } from "../common/text.js";

/**
 * Incentive progress — money PROMISED, not credited.
 *
 *   EN: "You're 2 orders away from a ₹150 bonus!"
 */
const PROMISED_RES: readonly RegExp[] = [
  new RegExp(`(?:away from a|to earn|and earn|unlock)\\s+${INR}`, "i"),
  new RegExp(`${INR}\\s*(?:extra\\s*)?कमाने के लिए`, "u"),
];

const PROGRESS_CONTEXT_RE = /orders? away|complete|more orders?|और ऑर्डर|ಇನ್ನೂ/iu;

export function parseIncentiveProgress(input: RawInput): NormalizedEvent | null {
  const text = fullText(input.title, input.text);
  if (!PROGRESS_CONTEXT_RE.test(text)) return null;

  for (const re of PROMISED_RES) {
    const m = re.exec(text);
    if (m) {
      const promised = capturedPaise(m[1]);
      if (promised !== null && promised > 0) {
        return {
          type: "incentive",
          platform: "zomato",
          timestamp: input.postedAt,
          promisedAmount: promised,
          criteriaText: text,
        };
      }
    }
  }
  return null;
}
