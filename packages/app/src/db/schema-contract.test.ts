import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PARSED_STATES } from "@hisaab/core";
import { REGISTRY } from "@hisaab/parsers";
import { describe, expect, it } from "vitest";
import { CAPTURE_MARKER_PACKAGE, DB_NAME, PARSED_STATE, RAW_EVENTS_SQL } from "./schema.js";

const KOTLIN_STORE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../android/app/src/main/java/app/hisaab/capture/RawEventStore.kt",
);

function kotlinSource(): string {
  return readFileSync(KOTLIN_STORE, "utf8");
}

function kotlinStringConst(source: string, name: string): string {
  const match = source.match(new RegExp(`${name} = """([\\s\\S]*?)"""`));
  if (!match?.[1]) throw new Error(`${name} triple-quoted constant not found in RawEventStore.kt`);
  return match[1];
}

/**
 * D-024: the raw_events DDL is dual-owned — the Kotlin capture module
 * bootstraps the table before the JS runtime exists, migration 001 runs the
 * same statements. These tests are the drift alarm.
 */
describe("raw_events schema contract (D-024)", () => {
  it("Kotlin RAW_EVENTS_SQL is byte-identical to schema.ts", () => {
    const kotlin = kotlinStringConst(kotlinSource(), "RAW_EVENTS_SQL");
    expect(kotlin.trim()).toBe(RAW_EVENTS_SQL.trim());
  });

  it("Kotlin uses the same database file name", () => {
    expect(kotlinSource()).toContain(`DB_NAME = "${DB_NAME}"`);
  });

  it("Kotlin uses the same gap-marker pseudo-package (D-025)", () => {
    expect(kotlinSource()).toContain(`CAPTURE_MARKER_PACKAGE = "${CAPTURE_MARKER_PACKAGE}"`);
  });

  it("Kotlin capture allowlist covers every parser-registry package", () => {
    // Capture must be a superset of parsing (TECH-DESIGN §5.1): a package
    // the registry can parse but native never captures would silently lose
    // earnings. The reverse (capture-only packages) is fine by design.
    const allowlist = readFileSync(join(dirname(KOTLIN_STORE), "PackageAllowlist.kt"), "utf8");
    for (const packageName of REGISTRY.flatMap((entry) => entry.packageNames ?? [])) {
      expect(allowlist, `PackageAllowlist.kt is missing ${packageName}`).toContain(
        `"${packageName}"`,
      );
    }
  });

  it("Kotlin parsed-state codes match core PARSED_STATES order", () => {
    const source = kotlinSource();
    expect(source).toContain(`PARSED_UNPARSED = ${PARSED_STATE.unparsed}`);
    expect(source).toContain(`PARSED_IGNORED = ${PARSED_STATE.ignored}`);
    // And the TS codes themselves pin to the core tuple.
    expect(PARSED_STATES[PARSED_STATE.unparsed]).toBe("unparsed");
    expect(PARSED_STATES[PARSED_STATE.parsed]).toBe("parsed");
    expect(PARSED_STATES[PARSED_STATE.parse_error]).toBe("parse_error");
    expect(PARSED_STATES[PARSED_STATE.ignored]).toBe("ignored");
  });
});
