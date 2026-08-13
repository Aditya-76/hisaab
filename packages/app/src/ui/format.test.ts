import { describe, expect, it } from "vitest";
import { dayParts, istClock, istTodayKey, previousDayKey } from "./format.js";

describe("istClock", () => {
  it("renders IST wall-clock 12h parts", () => {
    expect(istClock("2026-08-12T19:42:00+05:30")).toEqual({
      hour: 7,
      minute: "42",
      period: "pm",
    });
    // 19:00Z = 00:30 IST next day
    expect(istClock("2026-08-12T19:00:00.000Z")).toEqual({ hour: 12, minute: "30", period: "am" });
    expect(istClock("2026-08-12T06:30:00.000Z")).toEqual({ hour: 12, minute: "00", period: "pm" });
  });
});

describe("dayParts", () => {
  it("splits a day key with Monday-based weekday", () => {
    // 2026-08-13 is a Thursday.
    expect(dayParts("2026-08-13")).toEqual({ dayOfMonth: 13, monthIndex: 7, weekdayIndex: 3 });
  });
});

describe("istTodayKey / previousDayKey", () => {
  it("computes the IST day of an instant and steps back across months", () => {
    // 2026-08-12T19:00Z is already Aug 13 in IST.
    expect(istTodayKey(Date.parse("2026-08-12T19:00:00.000Z"))).toBe("2026-08-13");
    expect(previousDayKey("2026-08-01")).toBe("2026-07-31");
  });
});
