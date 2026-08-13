import { describe, expect, it } from "vitest";
import {
  EarningSchema,
  ExpenseSchema,
  IncentiveEventSchema,
  NormalizedEventSchema,
  PayoutCreditSchema,
  RawInputSchema,
} from "./types/index.js";

const TS = "2026-08-12T19:42:00+05:30";

describe("RawInputSchema", () => {
  it("accepts a notification input", () => {
    const input = RawInputSchema.parse({
      source: "notification",
      packageName: "in.swiggy.deliveryapp",
      title: "Order delivered",
      text: "You earned ₹42",
      postedAt: TS,
      appVersion: "4.2.1",
    });
    expect(input.source).toBe("notification");
  });

  it("accepts an SMS input", () => {
    const input = RawInputSchema.parse({
      source: "sms",
      sender: "VM-HDFCBK",
      text: "Rs.245.00 credited",
      postedAt: "2026-08-12T14:05:00Z",
    });
    expect(input.sender).toBe("VM-HDFCBK");
  });

  it("rejects timestamps without offset information", () => {
    expect(
      RawInputSchema.safeParse({ source: "sms", text: "x", postedAt: "2026-08-12 14:05" }).success,
    ).toBe(false);
  });
});

describe("EarningSchema", () => {
  const base = {
    type: "earning",
    platform: "swiggy",
    timestamp: TS,
    kind: "order",
    grossAmount: 4200,
  } as const;

  it("accepts a plain order earning", () => {
    expect(EarningSchema.parse(base).grossAmount).toBe(4200);
  });

  it("rejects float paise", () => {
    expect(EarningSchema.safeParse({ ...base, grossAmount: 42.5 }).success).toBe(false);
  });

  it("rejects negative amounts unless kind is adjustment", () => {
    expect(EarningSchema.safeParse({ ...base, grossAmount: -2000 }).success).toBe(false);
    expect(
      EarningSchema.safeParse({ ...base, kind: "adjustment", grossAmount: -2000 }).success,
    ).toBe(true);
  });
});

describe("NormalizedEventSchema (discriminated union)", () => {
  it("routes by the type literal", () => {
    const earning = NormalizedEventSchema.parse({
      type: "earning",
      platform: "zepto",
      timestamp: TS,
      kind: "order",
      grossAmount: 3500,
    });
    expect(earning.type).toBe("earning");

    const incentive = NormalizedEventSchema.parse({
      type: "incentive",
      platform: "zomato",
      timestamp: TS,
      promisedAmount: 20000,
      criteriaText: "Complete 12 orders",
    });
    expect(incentive.type).toBe("incentive");

    const payout = NormalizedEventSchema.parse({
      type: "payout",
      source: "bank",
      amount: 198000,
      timestamp: TS,
    });
    expect(payout.type).toBe("payout");
  });

  it("rejects unknown type literals", () => {
    expect(NormalizedEventSchema.safeParse({ type: "mystery" }).success).toBe(false);
  });
});

describe("PayoutCreditSchema", () => {
  it("requires a positive amount", () => {
    expect(
      PayoutCreditSchema.safeParse({ type: "payout", source: "upi", amount: 0, timestamp: TS })
        .success,
    ).toBe(false);
  });
});

describe("IncentiveEventSchema / ExpenseSchema", () => {
  it("accepts promised-only incentives", () => {
    const i = IncentiveEventSchema.parse({
      type: "incentive",
      platform: "swiggy",
      timestamp: TS,
      promisedAmount: 15000,
      criteriaText: "Peak hour bonus",
    });
    expect(i.creditedAmount).toBeUndefined();
  });

  it("rejects unknown expense categories", () => {
    expect(
      ExpenseSchema.safeParse({ category: "snacks", amount: 100, timestamp: TS }).success,
    ).toBe(false);
  });
});
