import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { normalizeText } from "../common/text.js";

/**
 * IMPS/NEFT bank credits — how weekly platform payout cycles usually land.
 * Variants covered (see fixtures/upi-sms/):
 *
 *   HDFC: "Rs.4,560.00 credited to a/c XX1234 on 13-08-26 by a/c linked to
 *          SWIGGY LIMITED (IMPS Ref 620912345678)."
 *   SBI:  "Your a/c X5678 is credited by Rs.2,140.00 on 13Aug26 by NEFT
 *          from ZOMATO MEDIA PRIVATE LIMITED."
 */
const AMOUNT_RES: readonly RegExp[] = [
  new RegExp(`${INR}\\s*(?:is\\s+)?credited`, "i"),
  new RegExp(`credited\\s+(?:by|with)\\s+${INR}`, "i"),
];

const NARRATION_RES: readonly RegExp[] = [
  /linked\s+to\s+([A-Za-z][A-Za-z .&]+?)(?=\s*\(|\s+IMPS|\s+NEFT|[.,]|$)/i,
  /(?:NEFT|IMPS|RTGS)\s+from\s+([A-Za-z][A-Za-z .&]+?)(?=[.,]|\s+Ref|$)/i,
  /from\s+([A-Z][A-Z .&]{2,}?)(?=[.,]|\s+Ref|$)/,
];

const ACCOUNT_RE = /a\/?c(?:ct)?\.?\s*(?:no\.?\s*)?([Xx*]*[0-9]{2,6})/i;

export function parseImpsNeftCredit(input: RawInput): NormalizedEvent | null {
  const text = normalizeText(input.text);
  if (!/\b(?:IMPS|NEFT|RTGS)\b/i.test(text)) return null;
  if (/debit/i.test(text)) return null;
  if (!/credited/i.test(text)) return null;

  let amount: number | null = null;
  for (const re of AMOUNT_RES) {
    const m = re.exec(text);
    if (m) {
      amount = capturedPaise(m[1]);
      if (amount !== null) break;
    }
  }
  if (amount === null || amount <= 0) return null;

  let narration: string | undefined;
  for (const re of NARRATION_RES) {
    const m = re.exec(text);
    if (m?.[1]) {
      narration = m[1].trim();
      break;
    }
  }

  const accountHint = ACCOUNT_RE.exec(text)?.[1];

  return {
    type: "payout",
    source: "bank",
    amount,
    timestamp: input.postedAt,
    ...(narration !== undefined ? { narration } : {}),
    ...(accountHint !== undefined ? { accountHint } : {}),
  };
}
