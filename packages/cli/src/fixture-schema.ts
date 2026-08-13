import { NormalizedEventSchema, RawInputSchema } from "@hisaab/core";
import { z } from "zod";

/** Shape of a fixture file in packages/parsers/fixtures. */
export const FixtureSchema = z.object({
  input: RawInputSchema,
  expected: z.union([NormalizedEventSchema, z.null(), z.literal("ignored")]),
  _meta: z.record(z.string(), z.unknown()).optional(),
});
export type Fixture = z.infer<typeof FixtureSchema>;
