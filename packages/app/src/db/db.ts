/**
 * Minimal async SQL interface the pipeline code is written against.
 *
 * Production implements it over op-sqlite (src/db/open.ts); tests implement
 * it over node:sqlite (src/testing/node-db.ts) so migrations, repos and the
 * drainer run against real SQLite on Linux CI with zero React Native
 * involvement (TECH-DESIGN §2, D-026).
 */

export type SqlValue = string | number | null;

export type SqlRow = Record<string, SqlValue>;

export interface DbExecutor {
  execute(sql: string, params?: readonly SqlValue[]): Promise<{ rows: SqlRow[] }>;
}

export interface Db extends DbExecutor {
  /** Runs `fn` inside BEGIN/COMMIT; any throw rolls back and re-throws. */
  transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T>;
}
