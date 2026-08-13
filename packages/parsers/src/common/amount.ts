import { parseInrToPaise } from "@hisaab/core";

/**
 * Reusable regex source for an INR amount with a currency marker, capturing
 * the numeric part. Compose into parser regexes: new RegExp(`earned ${INR}`).
 */
export const INR = String.raw`(?:₹|Rs\.?\s?|INR\s?)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)`;

/** Convert a captured numeric group to integer paise (null if malformed). */
export function capturedPaise(captured: string | undefined): number | null {
  if (captured === undefined) return null;
  return parseInrToPaise(captured);
}

/** First marker-prefixed amount in a text, as paise. */
export function firstAmountPaise(text: string): number | null {
  const match = new RegExp(INR).exec(text);
  return match ? capturedPaise(match[1]) : null;
}
