import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, closeDB } from "../lib/server/db";
test("schema v1 migration preserves users, lists and existing task data", () => {
  const directory = mkdtempSync(join(tmpdir(), "ervis-migration-"));
  process.env.DATA_DIR = directory;
  const old = new DatabaseSync(join(directory, "ervisio.sqlite"));
  old.exec(
    `CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,email TEXT NOT NULL COLLATE NOCASE UNIQUE,password TEXT,role TEXT NOT NULL DEFAULT 'user',session_version INTEGER NOT NULL DEFAULT 0,verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);CREATE TABLE lists(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),slug TEXT NOT NULL UNIQUE,subdomain TEXT UNIQUE,data TEXT NOT NULL);PRAGMA user_version=1;`,
  );
  old
    .prepare("INSERT INTO users(id,username,email,created_at) VALUES(?,?,?,?)")
    .run("old-user", "existing", "existing@example.test", "2026-10-01");
  old.prepare("INSERT INTO lists(id,owner,slug,data) VALUES(?,?,?,?)").run(
    "old-list",
    "old-user",
    "existing-list",
    JSON.stringify({
      title: "Keep this list",
      members: [],
      createdBy: "old-user",
    }),
  );
  old.close();
  try {
    const migrated = db();
    assert.equal(
      (migrated.prepare("SELECT count(*) n FROM users").get() as any).n,
      1,
    );
    assert.equal(
      JSON.parse(
        (
          migrated
            .prepare("SELECT data FROM lists WHERE id=?")
            .get("old-list") as any
        ).data,
      ).title,
      "Keep this list",
    );
    assert.equal(
      (migrated.prepare("SELECT project_id FROM lists").get() as any)
        .project_id,
      null,
    );
    assert.equal(
      (migrated.prepare("PRAGMA user_version").get() as any).user_version,
      3,
    );
  } finally {
    closeDB();
    rmSync(directory, { recursive: true, force: true });
  }
});
