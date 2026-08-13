import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { fullText } from "../common/text.js";

/**
 * Incentive actually credited by the platform — promised AND credited.
 *
 *   EN: "Incentive unlocked! ₹120 added to your earnings."
 *   HI: "इंसेंटिव मिला! ₹120 आपकी कमाई में जुड़ गए।"
 */
const CREDITED_RES: readonly RegExp[] = [
  new RegExp(`${INR}\\s*(?:incentive\\s+)?(?:added|credited)`, "i"),
  new RegExp(`incentive\\s+of\\s+${INR}\\s*(?:added|credited)`, "i"),
  new RegExp(`${INR}\\s*(?:आपकी कमाई में )?जुड़ गए`, "u"),
  new RegExp(`${INR}\\s*ಸೇರಿಸಲಾಗಿದೆ`, "u"),
];

const INCENTIVE_CONTEXT_RE = /incentive|bonus|इंसेंटिव|बोनस|ಇನ್ಸೆಂಟಿವ್|ಬೋನಸ್/iu;

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
