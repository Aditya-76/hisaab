import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { fullText } from "../common/text.js";

/**
 * Incentive progress nudges — money PROMISED, not yet credited.
 *
 *   EN: "Complete 3 more orders to earn ₹120 extra today!"
 *   HI: "आज ₹120 extra कमाने के लिए 3 और ऑर्डर पूरे करें!"
 */
const PROMISED_RES: readonly RegExp[] = [
  new RegExp(`(?:to earn|earn up to|and earn)\\s+${INR}`, "i"),
  new RegExp(`${INR}\\s*(?:extra\\s*)?कमाने के लिए`, "u"),
  new RegExp(`${INR}\\s*ಗಳಿಸಲು`, "u"),
];

const PROGRESS_CONTEXT_RE = /complete|more orders?|और ऑर्डर|पूरे करें|ಇನ್ನೂ|ಪೂರ್ಣಗೊಳಿಸಿ/iu;

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
          platform: "swiggy",
          timestamp: input.postedAt,
          promisedAmount: promised,
          criteriaText: text,
        };
      }
    }
  }
  return null;
}
