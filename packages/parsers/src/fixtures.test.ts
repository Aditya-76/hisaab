import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { NormalizedEventSchema, RawInputSchema } from "@hisaab/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseRawInput, REGISTRY } from "./registry.js";

/**
 * THE parser test: every fixture in ../fixtures must round-trip through the
 * registry exactly as recorded. Fixture files are themselves schema-checked,
 * so a malformed corpus fails CI loudly.
 */
const FixtureSchema = z.object({
  input: RawInputSchema,
  expected: z.union([NormalizedEventSchema, z.null(), z.literal("ignored")]),
  _meta: z.record(z.string(), z.unknown()).optional(),
});

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

const files = readdirSync(fixturesRoot, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.split(sep).join("/"))
  .sort();

describe("fixture corpus", () => {
  it("exists and is non-trivial", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  const parserIdsSeen = new Set<string>();

  for (const file of files) {
    it(file, () => {
      const raw = JSON.parse(readFileSync(join(fixturesRoot, file), "utf8"));
      const fixture = FixtureSchema.parse(raw);
      const result = parseRawInput(fixture.input);

      if (fixture.expected === null) {
        expect(result.status, `expected unparsed, got ${JSON.stringify(result)}`).toBe("unparsed");
      } else if (fixture.expected === "ignored") {
        expect(result.status, `expected ignored, got ${JSON.stringify(result)}`).toBe("ignored");
      } else {
        expect(result.status, `expected parsed, got ${JSON.stringify(result)}`).toBe("parsed");
        if (result.status === "parsed") {
          parserIdsSeen.add(result.parserId);
          expect(result.event).toEqual(fixture.expected);
        }
      }
    });
  }

  it("exercises every registered parser at least once", () => {
    const registered = REGISTRY.flatMap((entry) => entry.parsers.map((p) => p.id));
    const unexercised = registered.filter((id) => !parserIdsSeen.has(id));
    expect(unexercised, `parsers with no passing fixture: ${unexercised.join(", ")}`).toEqual([]);
  });

  it("keeps fixture filenames on the <type>.<lang>.<n>.json convention", () => {
    for (const file of files) {
      const base = file.split("/").at(-1) as string;
      expect(base, `bad fixture name: ${file}`).toMatch(/^[a-z0-9-]+\.(en|hi|kn)\.[0-9]+\.json$/);
    }
  });

  it("covers Hindi and Kannada notification variants (first-class, PRD §12)", () => {
    expect(files.some((f) => f.includes(".hi."))).toBe(true);
    expect(files.some((f) => f.includes(".kn."))).toBe(true);
  });

  it("gives every platform an ignore ('ignored') and an unknown-format (null) fixture", () => {
    const platforms = new Set(files.map((f) => relative(".", f).split("/")[0] as string));
    for (const platform of platforms) {
      const inPlatform = files.filter((f) => f.startsWith(`${platform}/`));
      const contents = inPlatform.map(
        (f) => JSON.parse(readFileSync(join(fixturesRoot, f), "utf8")) as { expected: unknown },
      );
      expect(
        contents.some((c) => c.expected === "ignored"),
        `${platform} has no ignored fixture`,
      ).toBe(true);
      expect(
        contents.some((c) => c.expected === null),
        `${platform} has no unparsed (null) fixture`,
      ).toBe(true);
    }
  });
});
