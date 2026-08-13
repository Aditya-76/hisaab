import type { RegistryEntry } from "../types.js";
import { ignoreZepto } from "./ignore.js";
import { parseIncentiveCredited } from "./incentive-credited.js";
import { parseOrderDelivered } from "./order-delivered.js";
import { parsePayoutSummary } from "./payout-summary.js";

/**
 * Zepto delivery partner app.
 * TO-VERIFY: the rider-app package name below is an unverified placeholder —
 * confirming real package names on a device is the first Phase-2 spike
 * (see fixtures/zepto/SUPPORTED_VERSIONS.md and PRD open question 4).
 */
export const zeptoEntry: RegistryEntry = {
  platform: "zepto",
  packageNames: ["com.zepto.rider"],
  parsers: [
    { id: "zepto/order-delivered", parse: parseOrderDelivered },
    { id: "zepto/incentive-credited", parse: parseIncentiveCredited },
    { id: "zepto/payout-summary", parse: parsePayoutSummary },
  ],
  ignore: ignoreZepto,
};
