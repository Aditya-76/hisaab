#!/usr/bin/env node
import { parseArgs } from "node:util";
import { coverageCommand } from "./commands/coverage.js";
import { parseCommand } from "./commands/parse.js";
import { runFixturesCommand } from "./commands/run-fixtures.js";

export type { CoverageReport } from "./commands/coverage.js";
export { computeCoverage } from "./commands/coverage.js";
export type { FixtureRunReport } from "./commands/run-fixtures.js";
export { defaultFixturesDir, runFixtures } from "./commands/run-fixtures.js";

const USAGE = `hisaab-cli — fixture harness for the hisaab parser pack

Usage:
  hisaab-cli parse <file|->            Parse one RawInput JSON, print the ParseResult
                                       (exit 0 parsed/ignored, 2 unparsed)
  hisaab-cli run-fixtures [dir]        Run the fixture corpus (default: @hisaab/parsers fixtures)
  hisaab-cli coverage <dir>            Parse coverage % over a directory of RawInput dumps

Options:
  --json      Machine-readable JSON output
  --summary   GitHub-flavored markdown (for CI step summaries)
  --compact   Single-line JSON (parse command)
`;

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: "boolean", default: false },
      summary: { type: "boolean", default: false },
      compact: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const [command, target] = positionals;
  if (values.help || command === undefined) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }

  switch (command) {
    case "parse": {
      if (target === undefined) {
        console.error("parse: missing <file|-> argument");
        return 1;
      }
      return parseCommand(target, { compact: values.compact });
    }
    case "run-fixtures":
      return runFixturesCommand(target, { json: values.json, summary: values.summary });
    case "coverage": {
      if (target === undefined) {
        console.error("coverage: missing <dir> argument");
        return 1;
      }
      return coverageCommand(target, { json: values.json });
    }
    default:
      console.error(`unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
