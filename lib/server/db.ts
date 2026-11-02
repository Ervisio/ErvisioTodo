import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

let connection: DatabaseSync | undefined;
export function db() {
  if (connection) return connection;
  const dir = resolve(process.env.DATA_DIR || "./data");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  connection = new DatabaseSync(resolve(dir, "ervisio.sqlite"));
  connection.exec(`
    PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE, password TEXT,
      role TEXT NOT NULL DEFAULT 'user', session_version INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(provider,subject)
    );
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id),
      slug TEXT NOT NULL UNIQUE, subdomain TEXT UNIQUE, data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tasks_list ON tasks(list_id,parent_id);
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY, list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL COLLATE NOCASE, data TEXT NOT NULL, UNIQUE(list_id,name)
    );
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id), list_id TEXT REFERENCES lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);

  `);
  connection.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id),
      slug TEXT NOT NULL UNIQUE, data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL,
      expires INTEGER NOT NULL, created_at INTEGER NOT NULL, last_used INTEGER
    );
    CREATE TABLE IF NOT EXISTS public_shares (
      id TEXT PRIMARY KEY, list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hash TEXT NOT NULL UNIQUE, expires INTEGER, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS shares_list ON public_shares(list_id);
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY, actor TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL, resource TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activity_time ON activity(created_at);
  `);
  const columns = connection.prepare("PRAGMA table_info(lists)").all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === "project_id"))
    connection.exec(
      "ALTER TABLE lists ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL",
    );
  const userColumns = connection.prepare("PRAGMA table_info(users)").all() as {
    name: string;
  }[];
  if (!userColumns.some((c) => c.name === "is_active"))
    connection.exec(
      "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
    );
  const tokenColumns = connection
    .prepare("PRAGMA table_info(api_tokens)")
    .all() as { name: string }[];
  for (const [name, sql] of [
    ["parent_id", "TEXT REFERENCES api_tokens(id) ON DELETE CASCADE"],
    ["resource_mode", "TEXT NOT NULL DEFAULT 'all'"],
    ["project_ids", "TEXT NOT NULL DEFAULT '[]'"],
    ["list_ids", "TEXT NOT NULL DEFAULT '[]'"],
  ] as const)
    if (!tokenColumns.some((c) => c.name === name))
      connection.exec(`ALTER TABLE api_tokens ADD COLUMN ${name} ${sql}`);
  connection.exec(
    "CREATE INDEX IF NOT EXISTS lists_project ON lists(project_id); PRAGMA user_version=3;",
  );
  return connection;
}
export function transaction<T>(fn: () => T): T {
  const c = db();
  c.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    c.exec("COMMIT");
    return value;
  } catch (e) {
    c.exec("ROLLBACK");
    throw e;
  }
}
export function closeDB() {
  connection?.close();
  connection = undefined;
}
