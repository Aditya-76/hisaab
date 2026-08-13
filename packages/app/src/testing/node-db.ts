import { DatabaseSync } from "node:sqlite";
import type { Db, DbExecutor, SqlRow, SqlValue } from "../db/db.js";

/**
 * Db implementation over node:sqlite for Vitest on Linux CI (D-026): the
 * pipeline (migrations, repos, drainer) runs against REAL SQLite — same
 * engine the device uses — with zero React Native involvement. Test-only;
 * never imported from app code.
 */
export function openNodeDb(path = ":memory:"): Db & { close(): void } {
  const db = new DatabaseSync(path);
  const executor: DbExecutor = {
    // async so a synchronous SQLite throw becomes a rejection, like op-sqlite.
    async execute(sql: string, params: readonly SqlValue[] = []) {
      // node:sqlite's all() executes any statement, returning [] for
      // non-readers — matching op-sqlite's execute() shape.
      const rows = db.prepare(sql).all(...params) as unknown as SqlRow[];
      return { rows: rows.map((row) => ({ ...row })) };
    },
  };
  return {
    execute: executor.execute,
    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
      db.exec("BEGIN");
      try {
        const out = await fn(executor);
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    close() {
      db.close();
    },
  };
}
