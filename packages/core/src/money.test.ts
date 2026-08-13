import { describe, expect, it } from "vitest";
import { assertPaise, formatPaise, normalizeDigits, parseInrToPaise } from "./money.js";

describe("parseInrToPaise", () => {
  it("parses plain and symbol-prefixed amounts", () => {
    expect(parseInrToPaise("₹42")).toBe(4200);
    expect(parseInrToPaise("Rs. 245")).toBe(24500);
    expect(parseInrToPaise("Rs.245.00")).toBe(24500);
    expect(parseInrToPaise("INR 1,234")).toBe(123400);
    expect(parseInrToPaise("42")).toBe(4200);
  });

  it("parses paise exactly, without float arithmetic", () => {
    expect(parseInrToPaise("₹1,234.50")).toBe(123450);
    expect(parseInrToPaise("₹0.05")).toBe(5);
    expect(parseInrToPaise("₹19.9")).toBe(1990); // single decimal digit = tens of paise
    // The classic float trap: 19.99 * 100 === 1998.9999…
    expect(parseInrToPaise("₹19.99")).toBe(1999);
  });

  it("handles Indian lakh grouping", () => {
    expect(parseInrToPaise("₹1,23,456")).toBe(12345600);
  });

  it("handles Devanagari and Kannada digits", () => {
    expect(parseInrToPaise("₹१२०")).toBe(12000);
    expect(parseInrToPaise("₹೧೨೦")).toBe(12000);
  });

  it("handles Hindi/Kannada rupee markers", () => {
    expect(parseInrToPaise("रु 120")).toBe(12000);
    expect(parseInrToPaise("ರೂ. 120")).toBe(12000);
  });

  it("rejects non-amounts", () => {
    expect(parseInrToPaise("hello")).toBeNull();
    expect(parseInrToPaise("")).toBeNull();
    expect(parseInrToPaise("₹1.234")).toBeNull(); // three decimal digits is not paise
    expect(parseInrToPaise("1,,2")).toBeNull();
  });
});

describe("formatPaise", () => {
  it("formats with Indian grouping", () => {
    expect(formatPaise(4200)).toBe("₹42");
    expect(formatPaise(123450)).toBe("₹1,234.50");
    expect(formatPaise(12345600)).toBe("₹1,23,456");
    expect(formatPaise(123456789)).toBe("₹12,34,567.89");
  });

  it("drops zero paise and keeps sub-rupee amounts", () => {
    expect(formatPaise(100)).toBe("₹1");
    expect(formatPaise(5)).toBe("₹0.05");
  });

  it("renders negatives with a leading minus", () => {
    expect(formatPaise(-15000)).toBe("-₹150");
  });

  it("throws on float paise", () => {
    expect(() => formatPaise(42.5)).toThrow(TypeError);
  });
});

describe("assertPaise", () => {
  it("passes integers through and rejects floats/NaN", () => {
    expect(assertPaise(0)).toBe(0);
    expect(assertPaise(-100)).toBe(-100);
    expect(() => assertPaise(1.5)).toThrow(TypeError);
    expect(() => assertPaise(Number.NaN)).toThrow(TypeError);
  });
});

describe("normalizeDigits", () => {
  it("maps Devanagari and Kannada digits, leaves the rest", () => {
    expect(normalizeDigits("०१२३४५६७८९")).toBe("0123456789");
    expect(normalizeDigits("೦೧೨೩೪೫೬೭೮೯")).toBe("0123456789");
    expect(normalizeDigits("₹१२० credited")).toBe("₹120 credited");
  });
});
