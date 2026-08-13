/**
 * Money helpers. All money in hisaab is integer paise (1 rupee = 100 paise);
 * these are the only functions that convert between text and paise, so amount
 * extraction has a single audited path.
 */

const DEVANAGARI_ZERO = 0x0966; // ०
const KANNADA_ZERO = 0x0ce6; // ೦

/** Map Devanagari (०१२…) and Kannada (೦೧೨…) digits to ASCII. */
export function normalizeDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (code >= DEVANAGARI_ZERO && code <= DEVANAGARI_ZERO + 9) {
      out += String(code - DEVANAGARI_ZERO);
    } else if (code >= KANNADA_ZERO && code <= KANNADA_ZERO + 9) {
      out += String(code - KANNADA_ZERO);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Matches a currency amount, with or without a currency marker:
 * "₹1,234.50", "Rs. 245", "Rs.245.00", "INR 1,23,456", "42", "रु 120".
 * Rupee and paise digit groups are parsed separately — no float arithmetic.
 */
const AMOUNT_RE = /^(?:₹|Rs\.?|INR|रु\.?|ರೂ\.?)?\s*([0-9][0-9,]*)(?:\.([0-9]{1,2}))?$/u;

/**
 * Parse a candidate amount string to integer paise. Returns null when the
 * string is not a plausible INR amount. Accepts Indian digit grouping
 * (1,23,456) and Devanagari/Kannada digits. Always non-negative — sign is
 * the caller's (parser's) decision, e.g. for penalty adjustments.
 */
export function parseInrToPaise(raw: string): number | null {
  const text = normalizeDigits(raw.trim());
  const match = AMOUNT_RE.exec(text);
  if (!match) return null;
  const rupeeGroups = match[1] as string;
  // Comma groups, when present, must look like real digit grouping
  // (Indian 1,23,456 or western 1,234,567) — rejects "1,,2", "1,2", "12,".
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{2,3})+)$/.test(rupeeGroups)) return null;
  const rupeeDigits = rupeeGroups.replaceAll(",", "");
  const rupees = Number.parseInt(rupeeDigits, 10);
  const paisePart = match[2] ?? "";
  const paise = paisePart.length === 0 ? 0 : Number.parseInt(paisePart.padEnd(2, "0"), 10);
  if (!Number.isSafeInteger(rupees * 100 + paise)) return null;
  return rupees * 100 + paise;
}

/** Assert a value is valid integer paise. Throws on floats/NaN. */
export function assertPaise(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`money must be integer paise, got: ${value}`);
  }
  return value;
}

/**
 * Format integer paise as an INR string with Indian digit grouping
 * (₹1,23,456.50). Whole-rupee amounts drop the paise part. Negative amounts
 * render with a leading "-" (UI layers may restyle).
 */
export function formatPaise(paise: number): string {
  assertPaise(paise);
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / 100);
  const fraction = abs % 100;
  const grouped = groupIndian(String(rupees));
  const fractionText = fraction === 0 ? "" : `.${String(fraction).padStart(2, "0")}`;
  return `${sign}₹${grouped}${fractionText}`;
}

/** Indian grouping: last three digits, then groups of two (1,23,456). */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const headGrouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${headGrouped},${tail}`;
}
