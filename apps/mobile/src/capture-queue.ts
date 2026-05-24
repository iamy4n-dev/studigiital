import * as SQLite from "expo-sqlite";

export type QueueStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueuedCapture {
  id: string;
  text: string;
  mode: string;
  status: QueueStatus;
  created_at: number;
  result_json: string | null;
}

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync("capture_queue.db");
  return _db;
}

export async function initQueue(): Promise<void> {
  await db().execAsync(`
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      result_json TEXT
    )
  `);
}

export async function enqueue(text: string, mode: string): Promise<string> {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await db().runAsync(
    "INSERT INTO queue (id, text, mode, status, created_at, result_json) VALUES (?, ?, ?, ?, ?, ?)",
    [id, text, mode, "pending", Date.now(), null]
  );
  return id;
}

export async function getByStatus(status: QueueStatus): Promise<QueuedCapture[]> {
  return db().getAllAsync<QueuedCapture>("SELECT * FROM queue WHERE status = ?", [status]);
}

export async function updateStatus(
  id: string,
  status: QueueStatus,
  result_json?: string
): Promise<void> {
  if (result_json !== undefined) {
    await db().runAsync("UPDATE queue SET status = ?, result_json = ? WHERE id = ?", [
      status,
      result_json,
      id,
    ]);
  } else {
    await db().runAsync("UPDATE queue SET status = ? WHERE id = ?", [status, id]);
  }
}
