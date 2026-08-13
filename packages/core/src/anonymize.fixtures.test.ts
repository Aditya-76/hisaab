import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { anonymize } from "./anonymize.js";

const FixtureSchema = z.object({
  input: z.string(),
  expected: z.string(),
  _meta: z.record(z.string(), z.unknown()).optional(),
});

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "anonymizer");

const files = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("anonymize (fixture-driven)", () => {
  it("has fixtures to run", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(file, () => {
      const fixture = FixtureSchema.parse(
        JSON.parse(readFileSync(join(fixturesDir, file), "utf8")),
      );
      expect(anonymize(fixture.input)).toBe(fixture.expected);
    });
  }
});
