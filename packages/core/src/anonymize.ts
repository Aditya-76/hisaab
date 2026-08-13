/**
 * Anonymizer for the contribution flow (PRD F5): strip names, phone numbers,
 * addresses, order/vehicle IDs; KEEP amounts and structural text. Pure
 * function, fixture-tested (fixtures/anonymizer/), EN/HI/KN patterns.
 *
 * Heuristic by design — the in-app flow always shows a before/after preview,
 * and the worker decides. Order of rules matters: amounts are shielded first
 * so ₹ values are never mangled, and specific IDs are replaced before the
 * broader name/address heuristics run.
 */

const AMOUNT_SHIELD =
  /(?:₹|Rs\.?\s?|INR\s?|रु\.?\s?|ರೂ\.?\s?)[0-9०-९೦-೯][0-9०-९೦-೯,]*(?:\.[0-9]{1,2})?/gu;

interface Rule {
  pattern: RegExp;
  replacement: string;
}

// Ordered. Specific → general.
const RULES: readonly Rule[] = [
  // UPI virtual payment addresses (before phones: VPAs often start with one).
  { pattern: /\b[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,15}\b/g, replacement: "<VPA>" },
  // Payment references ("UPI Ref No 520912345678", "IMPS Ref 6209…").
  {
    pattern: /\b((?:UPI|IMPS|NEFT|RTGS)\s*Ref(?:erence)?(?:\s*No)?\.?\s*:?\s*)[0-9]{6,}\b/gi,
    replacement: "$1<ID>",
  },
  // Indian mobile numbers, with or without +91 / separators.
  { pattern: /(?:\+91[\s-]?)?\b[6-9][0-9]{4}[\s-]?[0-9]{5}\b/g, replacement: "<PHONE>" },
  // Vehicle registrations (KA01AB1234, KA 01 AB 1234).
  {
    pattern: /\b[A-Z]{2}[\s-]?[0-9]{1,2}[\s-]?[A-Z]{1,3}[\s-]?[0-9]{4}\b/g,
    replacement: "<VEHICLE>",
  },
  // Explicit order/trip ids: "#ABC123", "order id 12345678", "Order #ZOM-4432".
  { pattern: /#[A-Za-z0-9-]{4,}\b/g, replacement: "<ID>" },
  // The id value must contain a digit so ordinary words ("order delivered")
  // are never swallowed.
  {
    pattern:
      /\b((?:order|trip|job|booking)\s*(?:id|no\.?|number)?\s*:?\s*)(?=[A-Za-z-]*[0-9])[A-Za-z0-9-]{5,}\b/gi,
    replacement: "$1<ID>",
  },
  // Unmasked long digit runs (unmasked account numbers, reference numbers).
  // Bank-masked fragments like "XX1234" / "a/c X5678" are deliberately KEPT.
  { pattern: /\b[0-9]{9,18}\b/g, replacement: "<ACCT>" },
  // Names after cue words (EN/HI/KN), conservative: 1–2 capitalized words.
  {
    pattern:
      /\b(delivered to|delivered by|picked up by|customer|received from|sent by|paid to)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g,
    replacement: "$1 <NAME>",
  },
  { pattern: /(ग्राहक का नाम|ग्राहक)\s*:?\s*[^\s,.।]+/gu, replacement: "$1 <NAME>" },
  { pattern: /(ಗ್ರಾಹಕ)\s*:?\s*[^\s,.]+/gu, replacement: "$1 <NAME>" },
  // Addresses after cue words, up to sentence end. Conservative span.
  {
    pattern: /\b(at|near|to|from)\s+((?:No\.?\s*)?[0-9]{1,4}[,/][^.!?\n]{4,60})/g,
    replacement: "$1 <ADDRESS>",
  },
];

// Private-use-area sentinels — cannot occur in real notification text.
const SHIELD_OPEN = "\uE000";
const SHIELD_CLOSE = "\uE001";
const SHIELD_RESTORE = /\uE000([0-9]+)\uE001/g;

/** Anonymize free text for sharing. Amounts are preserved verbatim. */
export function anonymize(text: string): string {
  // 1. Shield amounts.
  const shielded: string[] = [];
  let out = text.replace(AMOUNT_SHIELD, (m) => {
    shielded.push(m);
    return `${SHIELD_OPEN}${shielded.length - 1}${SHIELD_CLOSE}`;
  });
  // 2. PII rules, in order.
  for (const rule of RULES) {
    out = out.replace(rule.pattern, rule.replacement);
  }
  // 3. Restore amounts.
  out = out.replace(SHIELD_RESTORE, (_, i: string) => shielded[Number(i)] as string);
  return out;
}
