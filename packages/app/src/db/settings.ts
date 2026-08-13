import type { DbExecutor } from "./db.js";

/**
 * Key-value app settings (migration 002, D-027). Known keys are typed here
 * so callers can't fork spellings; values are plain strings.
 */
export const SETTING_KEYS = {
  /** UI language: "en" | "hi" | "kn". Absent until the worker picks one. */
  language: "language",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export async function getSetting(db: DbExecutor, key: SettingKey): Promise<string | null> {
  const { rows } = await db.execute("SELECT value FROM settings WHERE key = ?", [key]);
  return rows[0]?.value != null ? String(rows[0].value) : null;
}

export async function setSetting(db: DbExecutor, key: SettingKey, value: string): Promise<void> {
  await db.execute(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
