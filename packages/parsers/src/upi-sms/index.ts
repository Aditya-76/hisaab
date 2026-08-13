import type { RegistryEntry } from "../types.js";
import { ignoreUpiSms } from "./ignore.js";
import { parseImpsNeftCredit } from "./imps-neft-credit.js";
import { parseUpiCredit } from "./upi-credit.js";

/**
 * DLT sender headers of banks/UPI payment banks whose credit SMS we parse
 * (e.g. "VM-HDFCBK", "AD-SBIINB-S", "JM-ICICIB"). Non-matching senders are
 * never read into hisaab's tables at all (docs/TECH-DESIGN.md §5.2) — this
 * list is the second gate, mirrored from the capture allowlist.
 */
const SENDER_PATTERNS: readonly RegExp[] = [
  /HDFCBK/i,
  /SBIINB|SBIUPI|SBIPSG|SBIBNK/i,
  /ICICIB|ICICIT/i,
  /AXISBK/i,
  /KOTAKB/i,
  /PYTMBK|PAYTMB/i,
  /YESBNK/i,
  /IDFCFB/i,
  /INDUSB/i,
  /CANBNK/i,
  /UNIONB/i,
  /BOIIND/i,
  /PNBSMS/i,
  /FEDBNK/i,
  /AUBANK/i,
];

export const upiSmsEntry: RegistryEntry = {
  platform: "upi-sms",
  senderPatterns: SENDER_PATTERNS,
  parsers: [
    { id: "upi-sms/upi-credit", parse: parseUpiCredit },
    { id: "upi-sms/imps-neft-credit", parse: parseImpsNeftCredit },
  ],
  ignore: ignoreUpiSms,
};
