import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Aliases point at TS sources so tests run without a prior `tsc --build`;
// the built dist/ is what the CLI binary and the future app consume.
export default defineConfig({
  resolve: {
    alias: {
      "@hisaab/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@hisaab/parsers": fileURLToPath(new URL("./packages/parsers/src/index.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "core", include: ["packages/core/src/**/*.test.ts"] },
      },
      {
        extends: true,
        test: { name: "parsers", include: ["packages/parsers/src/**/*.test.ts"] },
      },
      {
        extends: true,
        test: { name: "cli", include: ["packages/cli/src/**/*.test.ts"] },
      },
      {
        // Pipeline-only (db/drainer over node:sqlite, D-026): app UI code
        // is not tested here and never imported by these tests.
        extends: true,
        test: { name: "app", include: ["packages/app/src/**/*.test.ts"] },
      },
    ],
  },
});
