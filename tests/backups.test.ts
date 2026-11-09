import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, closeDB } from "../lib/server/db";
import { registerUser } from "../lib/server/users";
import {
  backupConfig,
  listBackups,
  restoreBackup,
  runBackup,
  saveBackupConfig,
  testBackupTarget,
} from "../lib/server/backups";
import { seal, unseal } from "../lib/server/remote-storage";

/** Just enough of the S3 protocol (path style) for the SDK: head, put, get, list, delete. */
function fakeS3() {
  const objects = new Map<string, { body: Buffer; modified: Date }>();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://x"),
      key = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      if (request.method === "HEAD") return response.writeHead(200).end();
      if (request.method === "PUT") {
        objects.set(key, { body: Buffer.concat(chunks), modified: new Date() });
        return response.writeHead(200, { ETag: '"x"' }).end();
      }
      if (request.method === "DELETE") {
        objects.delete(key);
        return response.writeHead(204).end();
      }
      if (url.searchParams.has("list-type")) {
        const prefix = url.searchParams.get("prefix") || "",
          items = [...objects]
            .filter(([name]) => name.startsWith(prefix))
            .map(
              ([name, o]) =>
                `<Contents><Key>${name}</Key><Size>${o.body.length}</Size><LastModified>${o.modified.toISOString()}</LastModified></Contents>`,
            )
            .join("");
        return response
          .writeHead(200, { "Content-Type": "application/xml" })
          .end(
            `<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>${items}</ListBucketResult>`,
          );
      }
      const object = objects.get(key);
      if (!object) return response.writeHead(404).end();
      response
        .writeHead(200, { "Content-Length": object.body.length })
        .end(object.body);
    });
  });
  return { server, objects };
}

let directory: string,
  s3: ReturnType<typeof fakeS3>,
  endpoint: string,
  admin: string;
const target = () => ({
  type: "s3",
  endpoint,
  region: "us-east-1",
  bucket: "backups",
  directory: "todo",
  accessKeyId: "key",
  secretAccessKey: "secret",
  forcePathStyle: true,
});

before(async () => {
  directory = mkdtempSync(join(tmpdir(), "ervisio-backup-"));
  process.env.DATA_DIR = directory;
  process.env.AUTH_SECRET = "unit-test-secret-with-more-than-32-characters";
  s3 = fakeS3();
  await new Promise<void>((done) => s3.server.listen(0, "127.0.0.1", done));
  endpoint = `http://127.0.0.1:${(s3.server.address() as { port: number }).port}`;
  admin = (
    await registerUser({
      username: "root",
      email: "root@example.test",
      password: "Strong test passphrase 2026!",
    })
  ).id;
});
after(async () => {
  closeDB();
  await new Promise((done) => s3.server.close(done));
  rmSync(directory, { recursive: true, force: true });
});

test("secrets are sealed at rest and never returned", () => {
  assert.equal(unseal(seal("hunter2")), "hunter2");
  assert.notEqual(seal("hunter2"), "hunter2");
  saveBackupConfig({ target: target(), intervalHours: 0, keep: 2 });
  const stored = db()
    .prepare("SELECT value FROM settings WHERE key='backup'")
    .get() as { value: string };
  assert.ok(!stored.value.includes('secret"'));
  const config = backupConfig();
  assert.equal(
    (config.target as { secretAccessKey: string }).secretAccessKey,
    "",
  );
  assert.deepEqual(config.secretsSet, ["secretAccessKey"]);
});

test("a blank secret keeps the stored one", async () => {
  saveBackupConfig({ target: { ...target(), secretAccessKey: "" }, keep: 2 });
  assert.match((await testBackupTarget()).detail, /raggiungibile/);
});

test("scheduling needs a destination", () => {
  assert.throws(
    () => saveBackupConfig({ target: null, intervalHours: 6 }),
    /prima di attivare/,
  );
  saveBackupConfig({ target: target(), intervalHours: 0 });
});

test("backup, retention and restore round trip", async () => {
  db()
    .prepare("INSERT INTO settings(key,value) VALUES('marker','before')")
    .run();
  const first = await runBackup(admin);
  assert.match(first, /^ervisio-.*\.sqlite\.gz$/);
  db().prepare("UPDATE settings SET value='after' WHERE key='marker'").run();
  await new Promise((done) => setTimeout(done, 15));
  await runBackup(admin);
  await new Promise((done) => setTimeout(done, 15));
  await runBackup(admin);
  const remote = await listBackups();
  assert.equal(remote.length, 2, "keep=2 prunes the oldest copy");
  assert.ok(!remote.some((file) => file.name === first));

  // The newest copy already contains marker=after; restore the one that survived retention.
  db().prepare("UPDATE settings SET value='lost' WHERE key='marker'").run();
  await restoreBackup(remote[0].name, admin);
  const marker = db()
    .prepare("SELECT value FROM settings WHERE key='marker'")
    .get() as { value: string };
  assert.equal(marker.value, "after");
  assert.equal(
    backupConfig().target?.type,
    "s3",
    "backup settings survive a restore",
  );
});

test("restore refuses names and files that are not backups", async () => {
  await assert.rejects(
    () => restoreBackup("../etc/passwd", admin),
    /non valido/,
  );
  s3.objects.set("todo/ervisio-2099-01-01T00-00-00-000Z.sqlite", {
    body: Buffer.from("not a database"),
    modified: new Date(),
  });
  await assert.rejects(
    () => restoreBackup("ervisio-2099-01-01T00-00-00-000Z.sqlite", admin),
    /database valido|danneggiato|backup di ErvisioTodo/,
  );
});
