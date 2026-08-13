import type { RegistryEntry } from "../types.js";
import { ignoreSwiggy } from "./ignore.js";
import { parseIncentiveCredited } from "./incentive-credited.js";
import { parseIncentiveProgress } from "./incentive-progress.js";
import { parseOrderDelivered } from "./order-delivered.js";
import { parsePayoutSummary } from "./payout-summary.js";

/** Swiggy delivery partner app (covers food + Instamart with one app). */
export const swiggyEntry: RegistryEntry = {
  platform: "swiggy",
  packageNames: ["in.swiggy.deliveryapp"],
  parsers: [
    { id: "swiggy/order-delivered", parse: parseOrderDelivered },
    { id: "swiggy/incentive-credited", parse: parseIncentiveCredited },
    { id: "swiggy/incentive-progress", parse: parseIncentiveProgress },
    { id: "swiggy/payout-summary", parse: parsePayoutSummary },
  ],
  ignore: ignoreSwiggy,
};
