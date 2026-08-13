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
    ],
  },
});
