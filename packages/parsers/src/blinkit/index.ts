import type { RegistryEntry } from "../types.js";
import { ignoreBlinkit } from "./ignore.js";
import { parseIncentiveCredited } from "./incentive-credited.js";
import { parseOrderDelivered } from "./order-delivered.js";
import { parsePayoutSummary } from "./payout-summary.js";

/**
 * Blinkit delivery partner app.
 * TO-VERIFY: the rider-app package name below is an unverified placeholder —
 * confirming real package names on a device is the first Phase-2 spike
 * (see fixtures/blinkit/SUPPORTED_VERSIONS.md).
 */
export const blinkitEntry: RegistryEntry = {
  platform: "blinkit",
  packageNames: ["com.grofers.delivery"],
  parsers: [
    { id: "blinkit/order-delivered", parse: parseOrderDelivered },
    { id: "blinkit/incentive-credited", parse: parseIncentiveCredited },
    { id: "blinkit/payout-summary", parse: parsePayoutSummary },
  ],
  ignore: ignoreBlinkit,
};
