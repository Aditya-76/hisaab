import type { Db, DbExecutor } from "./db.js";
import { NORMALIZED_SQL, RAW_EVENTS_SQL, statementsOf } from "./schema.js";

/**
 * Ordered migrations, gated by PRAGMA user_version (TECH-DESIGN §4).
 * Append-only: never edit a shipped migration — add the next one. Every
 * migration lands with an up-test in migrations.test.ts.
 */
export interface Migration {
  /** Target user_version after this migration runs. Must be prior + 1. */
  version: number;
  description: string;
  up(tx: DbExecutor): Promise<void>;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: "initial schema: raw_events (shared with native, D-024) + normalized tables",
    async up(tx) {
      // raw_events uses IF NOT EXISTS: the Kotlin capture module may have
      // bootstrapped it before the JS runtime ever started (D-024).
      for (const stmt of statementsOf(RAW_EVENTS_SQL)) await tx.execute(stmt);
      for (const stmt of statementsOf(NORMALIZED_SQL)) await tx.execute(stmt);
    },
  },
];

export async function currentSchemaVersion(db: DbExecutor): Promise<number> {
  const { rows } = await db.execute("PRAGMA user_version");
  const value = rows[0]?.user_version;
  return typeof value === "number" ? value : 0;
}

/**
 * Run all pending migrations, each inside its own transaction with the
 * user_version bump — a failed migration leaves the DB at the last good
 * version. Throws on failure; the caller shows the safe-mode screen with
 * raw export instead of guessing (UX §5.3).
 */
export async function migrate(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  let version = await currentSchemaVersion(db);
  for (const migration of migrations) {
    if (migration.version <= version) continue;
    if (migration.version !== version + 1) {
      throw new Error(
        `migration gap: at user_version ${version}, next migration is ${migration.version}`,
      );
    }
    await db.transaction(async (tx) => {
      await migration.up(tx);
      // PRAGMA doesn't support bind params; version is a trusted integer.
      await tx.execute(`PRAGMA user_version = ${migration.version}`);
    });
    version = migration.version;
  }
  return version;
}
