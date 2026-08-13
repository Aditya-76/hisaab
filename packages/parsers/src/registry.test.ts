import type { RawInput } from "@hisaab/core";
import { describe, expect, it } from "vitest";
import { parseRawInput, REGISTRY } from "./registry.js";
import { PARSER_PACK_VERSION } from "./version.js";

const TS = "2026-08-12T19:42:00+05:30";

function notification(overrides: Partial<RawInput>): RawInput {
  return { source: "notification", text: "hello", postedAt: TS, ...overrides };
}

function sms(overrides: Partial<RawInput>): RawInput {
  return { source: "sms", text: "hello", postedAt: TS, ...overrides };
}

describe("routing", () => {
  it("unknown package → unparsed with NO platform guess", () => {
    const result = parseRawInput(
      notification({ packageName: "com.random.app", text: "You earned ₹42" }),
    );
    expect(result).toEqual({ status: "unparsed" });
  });

  it("unknown SMS sender → unparsed with NO platform guess (allowlist gate)", () => {
    const result = parseRawInput(sms({ sender: "VM-RANDOM", text: "Rs.245.00 credited via UPI" }));
    expect(result).toEqual({ status: "unparsed" });
  });

  it("missing packageName/sender → unparsed", () => {
    expect(parseRawInput(notification({}))).toEqual({ status: "unparsed" });
    expect(parseRawInput(sms({}))).toEqual({ status: "unparsed" });
  });

  it("allowlisted app + unrecognized text → unparsed WITH platform guess", () => {
    const result = parseRawInput(
      notification({
        packageName: "in.swiggy.deliveryapp",
        text: "Something completely new format",
      }),
    );
    expect(result).toEqual({ status: "unparsed", platformGuess: "swiggy" });
  });

  it("stamps parserId and PARSER_PACK_VERSION on parsed results", () => {
    const result = parseRawInput(
      notification({
        packageName: "in.swiggy.deliveryapp",
        title: "Order delivered!",
        text: "You earned ₹42 for this order.",
      }),
    );
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.parserId).toBe("swiggy/order-delivered");
      expect(result.parserPackVersion).toBe(PARSER_PACK_VERSION);
    }
  });
});

describe("ignore semantics (docs/INSTRUMENTATION.md §3)", () => {
  it("ignore runs only AFTER parsers — earnings text with marketing words still parses", () => {
    // "offer" would match the ignore list, but the order parser wins first.
    const result = parseRawInput(
      notification({
        packageName: "in.swiggy.deliveryapp",
        title: "Order delivered!",
        text: "You earned ₹42 for this order. Special offer inside!",
      }),
    );
    expect(result.status).toBe("parsed");
  });

  it("pure marketing from an allowlisted app → ignored, tagged with the platform", () => {
    const result = parseRawInput(
      notification({
        packageName: "in.swiggy.deliveryapp",
        title: "Monsoon offer!",
        text: "Get a new raincoat at 50% discount from the gear store.",
      }),
    );
    expect(result).toEqual({ status: "ignored", platform: "swiggy" });
  });

  it("a debit SMS from an allowlisted bank → ignored, never a payout credit", () => {
    const result = parseRawInput(
      sms({
        sender: "VM-HDFCBK",
        text: "Rs.500.00 debited from a/c XX1234 for UPI txn to merchant.",
      }),
    );
    expect(result).toEqual({ status: "ignored", platform: "upi-sms" });
  });
});

describe("registry invariants", () => {
  it("parser ids are globally unique", () => {
    const ids = REGISTRY.flatMap((e) => e.parsers.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry routes by package name or sender pattern, never neither", () => {
    for (const entry of REGISTRY) {
      const routes = (entry.packageNames?.length ?? 0) + (entry.senderPatterns?.length ?? 0);
      expect(routes, `${entry.platform} has no routing`).toBeGreaterThan(0);
    }
  });

  it("no two entries claim the same package name", () => {
    const names = REGISTRY.flatMap((e) => e.packageNames ?? []);
    expect(new Set(names).size).toBe(names.length);
  });
});
