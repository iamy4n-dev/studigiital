import * as SQLite from "expo-sqlite";
import { getTagColor } from "./tag-color";

export interface StoredTag {
  name: string;
  color: string;
}

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync("tag_store.db");
  return _db;
}

export async function initTagStore(): Promise<void> {
  await db().execAsync(`
    CREATE TABLE IF NOT EXISTS tags (
      name TEXT PRIMARY KEY,
      color TEXT NOT NULL
    )
  `);
}

export async function getOrCreateTagColor(name: string): Promise<string> {
  const row = await db().getFirstAsync<{ color: string }>(
    "SELECT color FROM tags WHERE name = ?",
    [name]
  );
  if (row) return row.color;

  const all = await getAllTags();
  const existing: Record<string, string> = {};
  for (const t of all) existing[t.name] = t.color;

  const color = getTagColor(name, existing);
  await db().runAsync("INSERT INTO tags (name, color) VALUES (?, ?)", [name, color]);
  return color;
}

export async function getAllTags(): Promise<StoredTag[]> {
  return db().getAllAsync<StoredTag>("SELECT name, color FROM tags");
}
