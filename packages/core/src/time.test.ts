import { describe, expect, it } from "vitest";
import { istDayKey, istWeekDays, istWeekKey } from "./time.js";

describe("istDayKey", () => {
  it("uses the Asia/Kolkata calendar date, not UTC", () => {
    // 18:29 UTC = 23:59 IST (same day); 18:30 UTC = 00:00 IST next day.
    expect(istDayKey("2026-08-12T18:29:59Z")).toBe("2026-08-12");
    expect(istDayKey("2026-08-12T18:30:00Z")).toBe("2026-08-13");
  });

  it("respects the offset carried by the input", () => {
    expect(istDayKey("2026-08-12T23:59:00+05:30")).toBe("2026-08-12");
    expect(istDayKey("2026-08-13T00:10:00+05:30")).toBe("2026-08-13");
    // Same instant expressed in a non-IST zone still lands on the IST date.
    expect(istDayKey("2026-08-12T20:40:00+02:00")).toBe("2026-08-13");
  });

  it("handles a shift crossing midnight (UX E5): each event keeps its own day", () => {
    expect(istDayKey("2026-08-12T23:45:00+05:30")).toBe("2026-08-12");
    expect(istDayKey("2026-08-13T00:15:00+05:30")).toBe("2026-08-13");
  });

  it("throws on garbage", () => {
    expect(() => istDayKey("not a date")).toThrow(TypeError);
  });
});

describe("istWeekKey", () => {
  it("returns the Monday of the IST week", () => {
    // 2026-08-13 is a Thursday; its week starts Monday 2026-08-10.
    expect(istWeekKey("2026-08-13T12:00:00+05:30")).toBe("2026-08-10");
  });

  it("keeps Sunday in the week of the preceding Monday (Mon–Sun weeks)", () => {
    // 2026-08-16 is a Sunday.
    expect(istWeekKey("2026-08-16T12:00:00+05:30")).toBe("2026-08-10");
    // Monday 2026-08-17 starts a new week.
    expect(istWeekKey("2026-08-17T00:00:00+05:30")).toBe("2026-08-17");
  });

  it("rolls Sunday→Monday on the IST boundary, not UTC", () => {
    // Sunday 23:50 IST is still the old week…
    expect(istWeekKey("2026-08-16T23:50:00+05:30")).toBe("2026-08-10");
    // …Monday 00:10 IST is the new one, even though it is still Sunday UTC.
    expect(istWeekKey("2026-08-17T00:10:00+05:30")).toBe("2026-08-17");
    expect(istWeekKey("2026-08-16T18:40:00Z")).toBe("2026-08-17");
  });
});

describe("istWeekDays", () => {
  it("returns the seven Mon–Sun day keys, crossing month ends", () => {
    // 2026-08-30 is a Sunday; week is Aug 24 – Aug 30.
    expect(istWeekDays("2026-08-30T10:00:00+05:30")).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
    // Week crossing into September.
    expect(istWeekDays("2026-09-01T10:00:00+05:30")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });
});
