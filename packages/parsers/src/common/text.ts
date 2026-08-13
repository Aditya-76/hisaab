import { normalizeDigits } from "@hisaab/core";

/**
 * Normalize notification/SMS text before matching: map Devanagari/Kannada
 * digits to ASCII, unify whitespace (NBSP, newlines) to single spaces.
 * Parsers match against this; raw text is stored untouched by the app.
 */
export function normalizeText(text: string): string {
  return normalizeDigits(text)
    .replace(/[\u00A0\u202F\u2009]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Title + text in one normalized string — many formats split information. */
export function fullText(title: string | undefined, text: string): string {
  return normalizeText(title ? `${title} ${text}` : text);
}
