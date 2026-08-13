#!/usr/bin/env node
// OSI-only dependency license gate (docs/PRD.md §10, docs/DECISIONS.md D-020).
// Uses pnpm's own license data — no extra dependency to audit.
import { execFileSync } from "node:child_process";

const OSI_APPROVED = new Set([
  "MIT",
  "Apache-2.0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "Unlicense",
  "Python-2.0",
  "MPL-2.0",
  "Zlib",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  // CC-BY-4.0 is not OSI-approved but is a data/attribution license used by
  // e.g. caniuse-lite; allow it only if it ever shows up in a dev toolchain.
  "CC-BY-4.0",
]);

// SPDX expressions like "(MIT OR Apache-2.0)" pass if any alternative is approved.
function licenseAllowed(expr) {
  if (OSI_APPROVED.has(expr)) return true;
  const parts = expr
    .replace(/[()]/g, " ")
    .split(/\s+(?:OR|AND)\s+|\s+/)
    .filter(Boolean);
  if (expr.includes("OR")) return parts.some((p) => OSI_APPROVED.has(p));
  return parts.length > 0 && parts.every((p) => OSI_APPROVED.has(p));
}

const raw = execFileSync("pnpm", ["licenses", "list", "--json", "--prod"], {
  encoding: "utf8",
});
const byLicense = JSON.parse(raw);

const offenders = [];
for (const [license, packages] of Object.entries(byLicense)) {
  if (!licenseAllowed(license)) {
    for (const pkg of packages) {
      offenders.push(`${pkg.name}@${(pkg.versions ?? []).join(",")} — ${license}`);
    }
  }
}

if (offenders.length > 0) {
  console.error("License audit FAILED. Non-allowlisted dependency licenses:");
  for (const line of offenders) console.error(`  - ${line}`);
  console.error("\nEvery dependency must carry an OSI-approved license (DECISIONS.md D-020).");
  process.exit(1);
}

const total = Object.values(byLicense).reduce((n, pkgs) => n + pkgs.length, 0);
console.log(`License audit passed: ${total} production packages, all allowlisted.`);
