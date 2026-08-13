#!/usr/bin/env node
// Enforces docs/TECH-DESIGN.md §2: packages/core, parsers and cli must have
// ZERO React Native (or React) anywhere in their dependency subtrees — they
// run on plain Node in CI and inside other tools.
import { execFileSync } from "node:child_process";

const GUARDED_PACKAGES = ["@hisaab/core", "@hisaab/parsers", "@hisaab/cli"];
const FORBIDDEN = /^(react|react-native|react-dom)$|^react-native-/;

let failed = false;

for (const pkg of GUARDED_PACKAGES) {
  const raw = execFileSync(
    "pnpm",
    ["--filter", pkg, "list", "--depth", "Infinity", "--json", "--prod"],
    { encoding: "utf8" },
  );
  const trees = JSON.parse(raw);
  const found = new Set();

  const walk = (deps) => {
    if (!deps) return;
    for (const [name, info] of Object.entries(deps)) {
      if (FORBIDDEN.test(name)) found.add(name);
      walk(info.dependencies);
    }
  };
  for (const tree of trees) {
    walk(tree.dependencies);
    walk(tree.optionalDependencies);
  }

  if (found.size > 0) {
    failed = true;
    console.error(`${pkg}: forbidden dependencies in subtree: ${[...found].join(", ")}`);
  } else {
    console.log(`${pkg}: clean (no React Native in dependency subtree).`);
  }
}

if (failed) {
  console.error(
    "\nBoundary check FAILED: core/parsers/cli must build and test with zero React Native dependencies (TECH-DESIGN §2).",
  );
  process.exit(1);
}
