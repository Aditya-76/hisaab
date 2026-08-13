import type { RegistryEntry } from "../types.js";
import { ignoreZomato } from "./ignore.js";
import { parseIncentiveCredited } from "./incentive-credited.js";
import { parseIncentiveProgress } from "./incentive-progress.js";
import { parseOrderDelivered } from "./order-delivered.js";
import { parsePayoutSummary } from "./payout-summary.js";

/**
 * Zomato delivery partner app.
 * TO-VERIFY: the rider-app package name below is an unverified placeholder —
 * confirming real package names on a device is the first Phase-2 spike
 * (see fixtures/zomato/SUPPORTED_VERSIONS.md).
 */
export const zomatoEntry: RegistryEntry = {
  platform: "zomato",
  packageNames: ["com.zomato.delivery"],
  parsers: [
    { id: "zomato/order-delivered", parse: parseOrderDelivered },
    { id: "zomato/incentive-credited", parse: parseIncentiveCredited },
    { id: "zomato/incentive-progress", parse: parseIncentiveProgress },
    { id: "zomato/payout-summary", parse: parsePayoutSummary },
  ],
  ignore: ignoreZomato,
};
