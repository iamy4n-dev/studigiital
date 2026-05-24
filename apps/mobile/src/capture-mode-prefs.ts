import * as SQLite from "expo-sqlite";

export type CaptureMode = "quick_text" | "photo" | "backlog";

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync("capture_queue.db");
  return _db;
}

export async function initModePrefs(): Promise<void> {
  await db().execAsync(`
    CREATE TABLE IF NOT EXISTS prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

export async function getLastMode(): Promise<CaptureMode> {
  const rows = await db().getAllAsync<{ value: string }>(
    "SELECT value FROM prefs WHERE key = ?",
    ["last_capture_mode"]
  );
  return (rows[0]?.value as CaptureMode) ?? "quick_text";
}

export async function setLastMode(mode: CaptureMode): Promise<void> {
  await db().runAsync(
    "INSERT OR REPLACE INTO prefs (key, value) VALUES (?, ?)",
    ["last_capture_mode", mode]
  );
}
