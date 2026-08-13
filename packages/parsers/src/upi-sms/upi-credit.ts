import type { NormalizedEvent, RawInput } from "@hisaab/core";
import { capturedPaise, INR } from "../common/amount.js";
import { normalizeText } from "../common/text.js";

/**
 * UPI credit SMS from banks — the rails most instant platform payouts arrive
 * on. Format variants covered (see fixtures/upi-sms/):
 *
 *   HDFC:  "Rs.245.00 credited to a/c XX1234 on 12-08-26 by VPA
 *           swiggy-payouts@axisbank (SWIGGY). UPI Ref No 520912345678."
 *   SBI:   "Dear UPI user A/C X1234 credited by Rs245.0 on date 12Aug26
 *           trf from SWIGGY LIMITED Refno 520912345678."
 *   ICICI: "Acct XX881 credited with Rs 1,980.00 on 12-Aug-26 from ZOMATO
 *           MEDIA PRIVATE LIMITED. UPI:520912345678."
 *   PPBL:  "Rs.120 received in your a/c XX443 from zepto.rider@paytm.
 *           UPI Ref: 520912345678."
 */
const AMOUNT_RES: readonly RegExp[] = [
  new RegExp(`${INR}\\s*(?:is\\s+)?(?:credited|received)`, "i"),
  new RegExp(`credited\\s+(?:by|with)\\s+${INR}`, "i"),
];

const NARRATION_RES: readonly RegExp[] = [
  /by\s+VPA\s+([a-z0-9._-]+@[a-z][a-z0-9]+)/i,
  /from\s+([a-z0-9._-]+@[a-z][a-z0-9]+)/i,
  /trf\s+from\s+([A-Za-z][A-Za-z .&]+?)(?=\s+Refno|\s+Ref\b|[.,]|$)/i,
  /from\s+([A-Z][A-Z .&]{2,}?)(?=\s+UPI|\s+Ref|[.,]|$)/,
  /\(([A-Z][A-Z ]{2,})\)/,
];

const ACCOUNT_RE = /a\/?c(?:ct)?\.?\s*(?:no\.?\s*)?([Xx*]*[0-9]{2,6})/i;

export function parseUpiCredit(input: RawInput): NormalizedEvent | null {
  const text = normalizeText(input.text);
  // Must be a UPI-rail credit, never a debit.
  if (!/\b(?:UPI|VPA)\b/i.test(text)) return null;
  if (/debit/i.test(text)) return null;
  if (!/credited|received/i.test(text)) return null;

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
    source: "upi",
    amount,
    timestamp: input.postedAt,
    ...(narration !== undefined ? { narration } : {}),
    ...(accountHint !== undefined ? { accountHint } : {}),
  };
}
