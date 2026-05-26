// In-memory mock for expo-sqlite — handles SQL patterns used by capture-queue.ts, capture-mode-prefs.ts, and tag-store.ts

interface QueueRow {
  id: string;
  text: string;
  mode: string;
  status: string;
  created_at: number;
  result_json: string | null;
}

interface TagRow {
  name: string;
  color: string;
}

const _rows: QueueRow[] = [];
const _prefs = new Map<string, string>();
const _tags = new Map<string, string>();

export function __reset(): void {
  _rows.length = 0;
  _prefs.clear();
  _tags.clear();
}

const _db = {
  async execAsync(_sql: string): Promise<void> {
    // CREATE TABLE IF NOT EXISTS — no-op, in-memory stores are always ready
  },

  async runAsync(sql: string, params: unknown[]): Promise<void> {
    if (sql.startsWith("INSERT INTO queue")) {
      const [id, text, mode, status, created_at, result_json] = params as [
        string,
        string,
        string,
        string,
        number,
        string | null,
      ];
      _rows.push({ id, text, mode, status, created_at, result_json });
    } else if (sql.startsWith("UPDATE queue SET status = ?, result_json")) {
      const [status, result_json, id] = params as [string, string, string];
      const row = _rows.find((r) => r.id === id);
      if (row) {
        row.status = status;
        row.result_json = result_json;
      }
    } else if (sql.startsWith("UPDATE queue SET status =")) {
      const [status, id] = params as [string, string];
      const row = _rows.find((r) => r.id === id);
      if (row) row.status = status;
    } else if (sql.startsWith("INSERT OR REPLACE INTO prefs")) {
      const [key, value] = params as [string, string];
      _prefs.set(key, value);
    } else if (sql.startsWith("INSERT INTO tags")) {
      const [name, color] = params as [string, string];
      _tags.set(name, color);
    }
  },

  async getFirstAsync<T>(sql: string, params: unknown[]): Promise<T | null> {
    if (sql.startsWith("SELECT color FROM tags WHERE name")) {
      const name = params[0] as string;
      const color = _tags.get(name);
      return color !== undefined ? ({ color } as unknown as T) : null;
    }
    return null;
  },

  async getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
    if (sql.startsWith("SELECT value FROM prefs")) {
      const key = (params ?? [])[0] as string;
      const value = _prefs.get(key);
      return (value !== undefined ? [{ value }] : []) as unknown as T[];
    }
    if (sql.startsWith("SELECT name, color FROM tags")) {
      return Array.from(_tags.entries()).map(([name, color]) => ({ name, color })) as unknown as T[];
    }
    return _rows.filter((r) => r.status === (params ?? [])[0]) as unknown as T[];
  },
};

export const openDatabaseSync = jest.fn().mockReturnValue(_db);
