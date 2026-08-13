import { open } from "@op-engineering/op-sqlite";
import type { Db, DbExecutor, SqlRow, SqlValue } from "./db.js";
import { DB_NAME } from "./schema.js";

/**
 * Production Db over op-sqlite (TECH-DESIGN §4): the same hisaab.db file the
 * Kotlin capture module writes into. WAL is op-sqlite's default journal
 * mode; the native side enables it too, so whichever opens first sets it.
 */
export function openAppDb(): Db {
  const db = open({ name: DB_NAME });

  const executor: DbExecutor = {
    async execute(sql: string, params: readonly SqlValue[] = []) {
      const result = await db.execute(sql, params as SqlValue[]);
      return { rows: (result.rows ?? []) as SqlRow[] };
    },
  };

  return {
    execute: executor.execute,
    transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        db.transaction(async (tx) => {
          try {
            const out = await fn({
              async execute(sql: string, params: readonly SqlValue[] = []) {
                const result = await tx.execute(sql, params as SqlValue[]);
                return { rows: (result.rows ?? []) as SqlRow[] };
              },
            });
            resolve(out);
          } catch (err) {
            reject(err);
            throw err; // make op-sqlite roll the transaction back
          }
        }).catch(reject);
      });
    },
  };
}
