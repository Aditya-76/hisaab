import type { RawInput } from "@hisaab/core";
import { fullText } from "../common/text.js";

/**
 * Known no-earnings chatter from the Swiggy rider app. Only consulted after
 * every parser returned null (registry rule), and fixture-tested so it can
 * never inflate parse coverage (docs/INSTRUMENTATION.md §3).
 */
const IGNORE_RES: readonly RegExp[] = [
  /high demand|go online|orders? (?:are )?waiting/i,
  /gear|helmet|t-shirt|jacket|kit\b/i,
  /rate your|rating|feedback/i,
  /offer|discount|sale\b|festive/i,
  /training|webinar|session/i,
  /refer (?:a |your )?friend|referral/i,
  /insurance|policy/i,
];

export function ignoreSwiggy(input: RawInput): boolean {
  const text = fullText(input.title, input.text);
  return IGNORE_RES.some((re) => re.test(text));
}
