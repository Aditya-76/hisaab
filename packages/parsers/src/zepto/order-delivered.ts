import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { fullText } from "../common/text.js";

/**
 * Zepto per-order earning.
 *
 *   EN: "Order delivered! ₹40 earned for this delivery."
 *   KN: "ಆರ್ಡರ್ ಡೆಲಿವರಿ ಆಯಿತು! ಈ ಡೆಲಿವರಿಗೆ ₹40 ಗಳಿಸಿದ್ದೀರಿ."
 */
const EARNED_RES: readonly RegExp[] = [
  new RegExp(`${INR}\\s*earned`, "i"),
  new RegExp(`(?:You earned|earned)\\s+${INR}`, "i"),
  new RegExp(`${INR}\\s*कमाए`, "u"),
  new RegExp(`${INR}\\s*ಗಳಿಸಿದ್ದೀರಿ`, "u"),
];

const ORDER_CONTEXT_RE = /order|delivery|ऑर्डर|डिलीवरी|ಆರ್ಡರ್|ಡೆಲಿವರಿ/iu;
const DELIVERED_RE = /deliver|डिलीवर|ಡೆಲಿವರಿ|ತಲುಪಿಸಲಾಗಿದೆ/iu;

const TIP_RES: readonly RegExp[] = [
  new RegExp(`incl(?:\\.|uding)?\\s+${INR}\\s*tip`, "i"),
  new RegExp(`${INR}\\s*tip`, "i"),
  new RegExp(`${INR}\\s*ಟಿಪ್`, "u"),
];

const EXTERNAL_ID_RE = /#([A-Z0-9-]{4,})/;

export function parseOrderDelivered(input: RawInput): NormalizedEvent | null {
  const text = fullText(input.title, input.text);
  if (!ORDER_CONTEXT_RE.test(text) || !DELIVERED_RE.test(text)) return null;

  let gross: number | null = null;
  for (const re of EARNED_RES) {
    const m = re.exec(text);
    if (m) {
      gross = capturedPaise(m[1]);
      if (gross !== null) break;
    }
  }
  if (gross === null || gross <= 0) return null;

  let tips: number | undefined;
  for (const re of TIP_RES) {
    const m = re.exec(text);
    if (m) {
      const t = capturedPaise(m[1]);
      if (t !== null && t !== gross) {
        tips = t;
        break;
      }
    }
  }

  const externalId = EXTERNAL_ID_RE.exec(text)?.[1];

  return {
    type: "earning",
    platform: "zepto",
    timestamp: input.postedAt,
    kind: "order",
    grossAmount: gross,
    ...(tips !== undefined ? { tips } : {}),
    ...(externalId !== undefined ? { externalId } : {}),
  };
}
