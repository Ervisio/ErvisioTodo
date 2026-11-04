import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { db, closeDB, transaction } from "../lib/server/db";
import { registerUser, oauthUser } from "../lib/server/users";
import {
  saveList,
  getList,
  listsFor,
  saveTask,
  getTask,
  rawTasks,
  saveTag,
  tagsFor,
  deleteTag,
  setTaskState,
  reorderTasks,
  tasksFor,
  enrichTask,
  brandingFor,
  caddySnippet,
} from "../lib/server/todo";
import {
  allowedHost,
  assertOrigin,
  safeReturnTo,
  digest,
  rateLimit,
} from "../lib/server/security";
import { consumeToken } from "../lib/server/mail";
import { fileFor, sniffMime, uploadFile } from "../lib/server/files";
let directory: string, alice: string, bob: string, stranger: string;
before(async () => {
  directory = mkdtempSync(join(tmpdir(), "ervisio-unit-"));
  process.env.DATA_DIR = directory;
  process.env.AUTH_URL = "https://todo.example.test";
  process.env.BASE_DOMAIN = "example.test";
  process.env.AUTH_COOKIE_DOMAIN = ".example.test";
  alice = (
    await registerUser({
      username: "alice",
      email: "alice@example.test",
      password: "Long test passphrase 1!",
    })
  ).id;
  bob = (
    await registerUser({
      username: "bob",
      email: "bob@example.test",
      password: "Long test passphrase 2!",
    })
  ).id;
  stranger = (
    await registerUser({
      username: "stranger",
      email: "stranger@example.test",
      password: "Long test passphrase 3!",
    })
  ).id;
});
after(() => {
  closeDB();
  rmSync(directory, { recursive: true, force: true });
});
const list = (slug: string, members: string[] = []) =>
  saveList({ title: slug, slug, members, subdomain: slug }, alice);
test("only the first registered user is admin; passwords are hashed and identities normalized", () => {
  const users = db()
    .prepare("SELECT * FROM users ORDER BY created_at")
    .all() as any[];
  assert.equal(users[0].role, "admin");
  assert.equal(users[1].role, "user");
  assert.match(users[0].password, /^\$2/);
  assert.throws(() =>
    saveList(
      { title: "x", slug: "x", createdBy: bob, members: ["missing"] },
      alice,
    ),
  );
});
test("empty members never means globally public, including for admin users", () => {
  const privateList = list("private");
  assert.throws(() => getList(privateList._id, bob), /non trovata/);
  const bobs = saveList({ title: "Bobs", slug: "bobs" }, bob);
  assert.throws(() => getList(bobs._id, alice), /non trovata/);
  assert.ok(!listsFor(bob).some((l) => l._id === privateList._id));
});
test("shared members can work with tasks, but cannot change owner, URL, or membership", () => {
  const shared = list("shared", [bob]);
  const task = saveTask(
    { listId: shared._id, title: "Shared task", assignedTo: [bob] },
    bob,
  );
  assert.equal(getTask(task._id, alice).title, "Shared task");
  assert.throws(() => saveList({ title: "Hijack" }, bob, shared._id));
  const updated = saveTask(
    {
      title: "Updated",
      listId: "fake",
      parentTaskId: "fake",
      createdBy: stranger,
      isCompleted: true,
    },
    bob,
    task._id,
  );
  assert.equal(updated.listId, shared._id);
  assert.equal(updated.parentTaskId, null);
  assert.equal(updated.isCompleted, false);
  assert.throws(() => getTask(task._id, stranger));
});
test("cross-list parent, tags and assignments are rejected", () => {
  const a = list("references-a", [bob]),
    b = list("references-b"),
    parent = saveTask({ listId: a._id, title: "Parent" }, alice),
    tag = saveTag({ listId: b._id, name: "private", color: "#112233" }, alice);
  assert.throws(() =>
    saveTask(
      { listId: b._id, parentTaskId: parent._id, title: "Bad parent" },
      alice,
    ),
  );
  assert.throws(() =>
    saveTask({ listId: a._id, title: "Bad tag", tags: [tag._id] }, alice),
  );
  assert.throws(() =>
    saveTask(
      { listId: a._id, title: "Bad assignee", assignedTo: [stranger] },
      alice,
    ),
  );
});
test("completion cascades; reopening a subtask reopens ancestors", () => {
  const l = list("hierarchy"),
    p = saveTask({ listId: l._id, title: "Parent" }, alice),
    c = saveTask({ listId: l._id, title: "Child", parentTaskId: p._id }, alice),
    g = saveTask(
      { listId: l._id, title: "Grandchild", parentTaskId: c._id },
      alice,
    );
  setTaskState(p._id, alice, "complete");
  assert.ok(
    rawTasks(l._id).every((t) => t.isCompleted && t.completedBy === alice),
  );
  setTaskState(g._id, alice, "reopen");
  assert.ok(
    rawTasks(l._id).every((t) => !t.isCompleted && t.completedAt === null),
  );
  db().prepare("DELETE FROM tasks WHERE id=?").run(p._id);
  assert.equal(rawTasks(l._id).length, 0);
});
test("list and task APIs report open top-level and direct subtask counts", () => {
  const l = list("counts"),
    openCount = () =>
      listsFor(alice).find((x) => x._id === l._id)!.openTaskCount,
    tasks = (query = "") => tasksFor(l._id, alice, new URLSearchParams(query)),
    add = (title: string, parentTaskId: string | null = null) =>
      saveTask({ listId: l._id, title, parentTaskId }, alice);
  assert.equal(openCount(), 0);
  const a = add("A"),
    b = add("B"),
    c1 = add("C1", a._id),
    c2 = add("C2", a._id),
    c3 = add("C3", a._id);
  add("G", c1._id);
  assert.equal(openCount(), 2);
  const row = (id: string) => tasks().find((t) => t._id === id)!;
  assert.deepEqual(
    [
      row(a._id).subtaskCount,
      row(a._id).subtaskDoneCount,
      row(a._id).childCount,
    ],
    [3, 0, 3],
  );
  assert.equal(row(b._id).subtaskCount, 0);
  setTaskState(c2._id, alice, "complete");
  assert.deepEqual(
    [
      row(a._id).subtaskCount,
      row(a._id).subtaskDoneCount,
      row(a._id).childCount,
    ],
    [3, 1, 2],
  );
  setTaskState(c1._id, alice, "complete");
  setTaskState(c3._id, alice, "complete");
  const done = tasks(`completed=true&parentTaskId=${a._id}`);
  assert.equal(done.length, 3);
  assert.deepEqual(
    [
      row(a._id).subtaskCount,
      row(a._id).subtaskDoneCount,
      row(a._id).childCount,
    ],
    [3, 3, 0],
  );
  assert.equal(done.find((t) => t._id === c1._id)!.subtaskDoneCount, 1);
  setTaskState(a._id, alice, "complete");
  assert.equal(openCount(), 1);
  assert.equal(
    listsFor(alice, null).find((x) => x._id === l._id)!.openTaskCount,
    1,
  );
  const stored = (id: string) => rawTasks(l._id).find((t) => t._id === id)!;
  assert.equal(enrichTask(stored(a._id)).subtaskCount, 3);
  assert.equal(enrichTask(stored(b._id)).subtaskCount, 0);
  assert.ok(!listsFor(bob).some((x) => x._id === l._id));
});
test("reordering is atomic when any ID is inaccessible, and cannot cross lists", () => {
  const a = list("reorder-a"),
    b = list("reorder-b"),
    x = saveTask({ listId: a._id, title: "x" }, alice),
    y = saveTask({ listId: a._id, title: "y" }, alice),
    z = saveTask({ listId: b._id, title: "z" }, alice);
  assert.throws(() => reorderTasks({ ids: [y._id, "missing", x._id] }, alice));
  assert.equal(getTask(x._id, alice).order, 0);
  assert.throws(() => reorderTasks({ ids: [x._id, z._id] }, alice));
  assert.throws(() => reorderTasks({ ids: [x._id, x._id] }, alice));
  reorderTasks({ ids: [y._id, x._id] }, alice);
  assert.equal(getTask(y._id, alice).order, 0);
  assert.equal(getTask(x._id, alice).order, 1);
});
test("removing members removes assignments and revokes access to tasks and tags", () => {
  const l = list("revoke", [bob]),
    tag = saveTag({ listId: l._id, name: "Team", color: "#336699" }, bob),
    task = saveTask(
      { listId: l._id, title: "Assigned", assignedTo: [bob], tags: [tag._id] },
      alice,
    );
  saveList({ members: [] }, alice, l._id);
  assert.equal(getTask(task._id, alice).assignedTo.length, 0);
  assert.throws(() => tagsFor(l._id, bob));
  assert.throws(() => getTask(task._id, bob));
  deleteTag(tag._id, alice);
  assert.equal(getTask(task._id, alice).tags.length, 0);
});
test("URL uniqueness, reserved domains and branding validation", () => {
  const l = list("brand");
  assert.throws(() => list("brand"), /già utilizzato/);
  assert.throws(() =>
    saveList({ title: "bad", slug: "bad-domain", subdomain: "admin" }, alice),
  );
  assert.throws(() =>
    saveList(
      {
        title: "bad",
        slug: "bad-color",
        accentColor: "red; background:url(x)",
      },
      alice,
    ),
  );
  assert.throws(() =>
    saveList(
      {
        title: "bad",
        slug: "bad-icon",
        iconType: "image",
        iconValue: "javascript:alert(1)",
      },
      alice,
    ),
  );
  assert.equal(brandingFor("brand.example.test")?.title, "brand");
  assert.ok(!brandingFor("brand.evil.test"));
  assert.match(caddySnippet(l, "docker"), /reverse_proxy app:3000/);
  assert.match(caddySnippet(l, "standalone"), /127.0.0.1:3000/);
  assert.equal(allowedHost("brand.example.test"), true);
  assert.equal(allowedHost("unassigned.example.test"), false);
  assert.equal(allowedHost("brand.example.test.evil.org"), false);
});
test("OAuth identities require explicit linking; closed registration rejects new identities", () => {
  assert.throws(
    () =>
      oauthUser("google", "google-alice", "alice@example.test", "Alice", true),
    /Collega/,
  );
  const linked = oauthUser(
    "google",
    "google-alice",
    "alice@example.test",
    "Alice",
    true,
    alice,
  );
  assert.equal(linked.id, alice);
  assert.equal(
    oauthUser("google", "google-alice", "newmail@example.test", "Alice", false)
      .id,
    alice,
  );
  assert.throws(
    () => oauthUser("google", "google-alice", null, "Alice", true, bob),
    /altro account/,
  );
  assert.throws(
    () => oauthUser("discord", "new-subject", "new@example.test", "New", false),
    /disabilitata/,
  );
});
test("CSRF and redirect allowlist reject unrelated origins and unassigned subdomains", () => {
  assert.throws(() =>
    assertOrigin(
      new Request("https://todo.example.test/api/admin/todo/lists", {
        method: "POST",
        headers: { host: "todo.example.test", origin: "https://evil.org" },
      }),
    ),
  );
  assert.throws(() =>
    assertOrigin(
      new Request("https://todo.example.test/api/admin/todo/lists", {
        method: "POST",
        headers: { host: "todo.example.test" },
      }),
    ),
  );
  assertOrigin(
    new Request("https://todo.example.test/api/admin/todo/lists", {
      method: "POST",
      headers: {
        host: "todo.example.test",
        origin: "https://todo.example.test",
      },
    }),
  );
  assert.equal(safeReturnTo("https://evil.org"), "https://todo.example.test");
  assert.equal(safeReturnTo("//evil.org"), "https://todo.example.test");
  assert.equal(
    safeReturnTo("https://brand.example.test"),
    "https://brand.example.test/",
  );
});
test("recovery tokens expire, are single-use, and database transactions roll back", () => {
  const token = randomBytes(32).toString("hex");
  db()
    .prepare("INSERT INTO tokens(hash,user_id,kind,expires) VALUES(?,?,?,?)")
    .run(digest(token), alice, "reset", Date.now() + 10_000);
  consumeToken(token, "reset", (id) => assert.equal(id, alice));
  assert.throws(() => consumeToken(token, "reset", () => {}));
  db()
    .prepare("INSERT INTO tokens(hash,user_id,kind,expires) VALUES(?,?,?,?)")
    .run(digest(token), alice, "reset", Date.now() - 1);
  assert.throws(() => consumeToken(token, "reset", () => {}));
  assert.throws(() =>
    transaction(() => {
      db().prepare("DELETE FROM tokens").run();
      throw Error("abort");
    }),
  );
  assert.ok(
    db().prepare("SELECT 1 FROM tokens WHERE hash=?").get(digest(token)),
  );
});
test("uploaded files remain private; raster branding becomes publicly readable only when selected", async () => {
  const l = list("file-team", [bob]),
    form = new FormData();
  form.set(
    "file",
    new File(["private document"], "secret.txt", { type: "text/plain" }),
  );
  form.set("listId", l._id);
  const url = await uploadFile(
      new Request("https://todo.example.test/api/admin/upload", {
        method: "POST",
        body: form,
      }),
      alice,
    ),
    id = url.split("/").pop()!;
  assert.throws(() => fileFor(id));
  assert.throws(() => fileFor(id, stranger));
  assert.equal(fileFor(id, bob).mime, "application/octet-stream");
  saveList({ members: [] }, alice, l._id);
  assert.throws(() => fileFor(id, bob));
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(sniffMime(png), "image/png");
  assert.equal(
    sniffMime(Buffer.from('<svg onload="alert(1)"/>')),
    "application/octet-stream",
  );
  const image = new FormData();
  image.set("file", new File([png], "favicon.png"));
  const imageUrl = await uploadFile(
      new Request("https://todo.example.test/api/admin/upload", {
        method: "POST",
        body: image,
      }),
      alice,
    ),
    imageId = imageUrl.split("/").pop()!;
  assert.throws(() => fileFor(imageId));
  saveList({ faviconUrl: imageUrl }, alice, l._id);
  assert.ok(fileFor(imageId).public);
});
test("rate limits are persisted and enforced", () => {
  rateLimit("test-key", 2);
  rateLimit("test-key", 2);
  assert.throws(() => rateLimit("test-key", 2), /Troppi tentativi/);
});

test("projects inherit access while private standalone lists remain private; deleting a project preserves all tasks", async () => {
  const { saveProject, getProject, deleteProject } =
    await import("../lib/server/projects");
  const p = saveProject(
    { title: "Release project", slug: "release-project", members: [bob] },
    alice,
  );
  const l = saveList(
    { title: "Contained", slug: "contained", projectId: p._id },
    alice,
  );
  const task = saveTask(
    { listId: l._id, title: "Inherited", assignedTo: [bob] },
    bob,
  );
  assert.equal(getList(l._id, bob).projectId, p._id);
  assert.throws(() => getProject(p._id, stranger));
  assert.throws(() => saveProject({ title: "Hijack" }, bob, p._id));
  assert.throws(() =>
    saveList(
      { title: "Bad move", slug: "bad-move", projectId: p._id },
      stranger,
    ),
  );
  saveProject({ members: [] }, alice, p._id);
  assert.throws(() => getTask(task._id, bob));
  assert.deepEqual(getTask(task._id, alice).assignedTo, []);
  deleteProject(p._id, alice);
  assert.equal(getList(l._id, alice).projectId, null);
  assert.equal(getTask(task._id, alice).title, "Inherited");
});
test("project owner can administer a member-owned list without taking ownership", async () => {
  const { saveProject } = await import("../lib/server/projects");
  const p = saveProject(
    { title: "Shared container", slug: "shared-container", members: [bob] },
    alice,
  );
  const l = saveList(
    { title: "By Bob", slug: "by-bob", projectId: p._id },
    bob,
  );
  const changed = saveList({ title: "Managed by project owner" }, alice, l._id);
  assert.equal(changed.createdBy, bob);
  assert.equal(
    (db().prepare("SELECT owner FROM lists WHERE id=?").get(l._id) as any)
      .owner,
    bob,
  );
});
test("partial task updates retain descriptions, tags, favorites and assignments", () => {
  const l = list("partial-data", [bob]),
    tag = saveTag({ listId: l._id, name: "Preserve", color: "#556677" }, alice);
  const original = saveTask(
    {
      listId: l._id,
      title: "Original",
      description: "Keep this text",
      isFavorite: true,
      assignedTo: [bob],
      tags: [tag._id],
    },
    alice,
  );
  const changed = saveTask({ title: "New title" }, alice, original._id);
  assert.equal(changed.description, "Keep this text");
  assert.equal(changed.isFavorite, true);
  assert.deepEqual(changed.tags, [tag._id]);
  assert.deepEqual(changed.assignedTo, [bob]);
});
test("workspace settings preserve omitted fields and enforce validation and audit retention", async () => {
  const { saveSettings, workspaceSettings, recordActivity } =
    await import("../lib/server/settings");
  const original = workspaceSettings();
  try {
    saveSettings({ siteName: "Test Workspace", storageQuotaGb: 1 });
    saveSettings({ registration: false });
    assert.equal(workspaceSettings().siteName, "Test Workspace");
    assert.equal(workspaceSettings().storageQuotaGb, 1);
    assert.throws(() => saveSettings({ role: "admin" }));
    assert.throws(() =>
      saveSettings({ maxTokenLifetimeDays: 1, defaultTokenLifetimeDays: 2 }),
    );
    db()
      .prepare(
        "INSERT INTO activity(actor,action,resource,created_at) VALUES(?,?,?,?)",
      )
      .run(alice, "old", "", Date.now() - 400 * 86400000);
    saveSettings({ statsRetentionDays: 30 });
    recordActivity(alice, "test");
    assert.equal(
      (
        db()
          .prepare("SELECT count(*) n FROM activity WHERE action='old'")
          .get() as any
      ).n,
      0,
    );
  } finally {
    saveSettings({ ...original, registration: true });
  }
});
test("API tokens are scoped, hashed, expiring and immediately disabled by workspace policy", async () => {
  const { createToken, actorFromToken, deleteToken } =
      await import("../lib/server/tokens"),
    { byId } = await import("../lib/server/users"),
    { saveSettings, workspaceSettings } =
      await import("../lib/server/settings");
  const settings = workspaceSettings(),
    token = createToken(
      { name: "Automation", scopes: ["read"], lifetimeDays: 1 },
      byId(bob)!,
    );
  const request = (method = "GET") =>
    new Request("https://todo.example.test/api/admin/todo/lists", {
      method,
      headers: { Authorization: `Bearer ${token.token}` },
    });
  try {
    assert.equal(actorFromToken(request())?.id, bob);
    assert.throws(() => actorFromToken(request("POST")));
    const stored = db()
      .prepare("SELECT hash FROM api_tokens WHERE id=?")
      .get(token.id) as any;
    assert.notEqual(stored.hash, token.token);
    assert.throws(() => deleteToken(token.id, alice));
    saveSettings({ membersCanCreateTokens: false });
    assert.throws(() => actorFromToken(request()));
    saveSettings({ membersCanCreateTokens: true, apiEnabled: false });
    assert.throws(() => actorFromToken(request()));
    saveSettings({ apiEnabled: true });
    db()
      .prepare("UPDATE api_tokens SET expires=? WHERE id=?")
      .run(Date.now() - 1, token.id);
    assert.throws(() => actorFromToken(request()));
    deleteToken(token.id, bob);
    assert.throws(() => actorFromToken(request()));
  } finally {
    saveSettings(settings);
  }
});
test("public shares expose only selected read-only fields and honor expiry and global revocation", async () => {
  const { createShare, sharedList, deleteShare } =
      await import("../lib/server/shares"),
    { saveSettings, workspaceSettings } =
      await import("../lib/server/settings");
  const settings = workspaceSettings(),
    l = list("share-read"),
    task = saveTask(
      {
        listId: l._id,
        title: "Public title",
        description: "Public description",
        assignedTo: [alice],
      },
      alice,
    );
  const share = createShare(l._id, alice, { lifetimeHours: 24 });
  try {
    const value = sharedList(share.token);
    assert.equal(value.tasks[0].title, "Public title");
    assert.ok(!("assignedTo" in value.tasks[0]));
    assert.ok(!("attachments" in value.tasks[0]));
    assert.throws(() => createShare(l._id, bob, {}));
    saveSettings({ sharingEnabled: false });
    assert.throws(() => sharedList(share.token));
    saveSettings({ sharingEnabled: true });
    db()
      .prepare("UPDATE public_shares SET expires=? WHERE id=?")
      .run(Date.now() - 1, share.id);
    assert.throws(() => sharedList(share.token));
    deleteShare(l._id, share.id, alice);
    assert.throws(() => sharedList(share.token));
  } finally {
    saveSettings(settings);
  }
});
test("attachment size, file count, quotas and description limits are enforced atomically", async () => {
  const { uploadFiles } = await import("../lib/server/files"),
    { saveSettings, workspaceSettings, storageUsage } =
      await import("../lib/server/settings");
  const settings = workspaceSettings(),
    request = (sizes: number[]) => {
      const form = new FormData();
      for (const size of sizes)
        form.append("file", new File([new Uint8Array(size)], "test.bin"));
      return new Request("https://todo.example.test/api/admin/upload", {
        method: "POST",
        body: form,
      });
    };
  try {
    saveSettings({ uploadMaxMb: 0.001, maxFilesPerUpload: 1 });
    await assert.rejects(() => uploadFiles(request([2000]), alice));
    await assert.rejects(() => uploadFiles(request([10, 10]), alice));
    const before = storageUsage().files;
    saveSettings({
      maxFilesPerUpload: 0,
      storageQuotaGb: (storageUsage().bytes + 15) / 1024 ** 3,
    });
    await assert.rejects(() => uploadFiles(request([10, 10]), alice));
    assert.equal(storageUsage().files, before);
    saveSettings({ storageQuotaGb: 0, userQuotaGb: 0 });
    assert.equal((await uploadFiles(request([10, 10]), alice)).length, 2);
    const l = list("text-limit");
    saveSettings({ editorMaxMb: 0.00001 });
    assert.throws(() =>
      saveTask(
        { listId: l._id, title: "Too long", description: "a".repeat(20) },
        alice,
      ),
    );
  } finally {
    saveSettings(settings);
  }
});

test("resource-scoped tokens constrain direct lookups, descendants and compatibility routes; derived tokens cannot broaden access", async () => {
  const { createToken, actorFromToken, deleteToken } =
      await import("../lib/server/tokens"),
    { actorContext } = await import("../lib/server/api-policy"),
    { byId } = await import("../lib/server/users"),
    { saveProject, getProject } = await import("../lib/server/projects");
  const project = saveProject(
      { title: "Scoped", slug: "scoped-project" },
      alice,
    ),
    allowed = saveList(
      { title: "Allowed", slug: "scoped-allowed", projectId: project._id },
      alice,
    ),
    denied = list("scoped-denied"),
    task = saveTask({ title: "Scoped task", listId: allowed._id }, alice);
  const token = createToken(
    {
      name: "Limited",
      scopes: ["tasks:read", "lists:read", "tokens:write"],
      resourceMode: "selected",
      listIds: [allowed._id],
    },
    byId(alice)!,
  );
  const request = (path: string, method = "GET") =>
    new Request("https://todo.example.test" + path, {
      method,
      headers: { Authorization: `Bearer ${token.token}` },
    });
  const actor = actorFromToken(request("/api/v1/lists"))!;
  actorContext.run(actor, () => {
    assert.equal(getList(allowed._id, alice)._id, allowed._id);
    assert.equal(getTask(task._id, alice)._id, task._id);
    assert.throws(() => getList(denied._id, alice));
    assert.throws(() => getProject(project._id, alice));
    assert.deepEqual(
      listsFor(alice).map((l) => l._id),
      [allowed._id],
    );
    assert.throws(() =>
      saveList({ title: "Denied", slug: "token-cannot-create" }, alice),
    );
    assert.throws(() =>
      createToken({ name: "Broad", scopes: ["write"] }, actor),
    );
    const child = createToken(
      { name: "Child", scopes: ["lists:read"], resourceMode: "all" },
      actor,
    );
    const childActor = actorFromToken(
      new Request("https://todo.example.test/api/v1/lists", {
        headers: { Authorization: `Bearer ${child.token}` },
      }),
    )!;
    actorContext.run(childActor, () => {
      assert.throws(() => getList(denied._id, alice));
      assert.equal(getList(allowed._id, alice)._id, allowed._id);
    });
    deleteToken(token.id, alice);
    assert.throws(() =>
      actorFromToken(
        new Request("https://todo.example.test/api/v1/lists", {
          headers: { Authorization: `Bearer ${child.token}` },
        }),
      ),
    );
  });
  const taskOnly = createToken(
    { name: "Task reader", scopes: ["tasks:read"] },
    byId(alice)!,
  );
  assert.throws(() =>
    actorFromToken(
      new Request("https://todo.example.test/api/v1/settings", {
        headers: { Authorization: `Bearer ${taskOnly.token}` },
      }),
    ),
  );
  assert.equal(
    actorFromToken(
      new Request("https://todo.example.test/api/v1/me", {
        headers: { Authorization: `Bearer ${taskOnly.token}` },
      }),
    )?.id,
    alice,
  );
});
test("task subtree move/copy remaps parents and clones private cross-list files; cycles are rejected", async () => {
  const { transferTask } = await import("../lib/server/task-transfer");
  const from = list("transfer-from"),
    to = list("transfer-to"),
    form = new FormData();
  form.set("listId", from._id);
  form.set("file", new File(["private content"], "private.txt"));
  const url = await uploadFile(
    new Request("https://todo.example.test/api/admin/upload", {
      method: "POST",
      body: form,
    }),
    alice,
  );
  const root = saveTask(
      {
        listId: from._id,
        title: "Root",
        attachments: [{ url, name: "private.txt", mimeType: "text/plain" }],
      },
      alice,
    ),
    child = saveTask(
      { listId: from._id, parentTaskId: root._id, title: "Child" },
      alice,
    ),
    grandchild = saveTask(
      { listId: from._id, parentTaskId: child._id, title: "Grandchild" },
      alice,
    );
  assert.throws(() =>
    transferTask(
      root._id,
      { listId: from._id, parentTaskId: grandchild._id },
      alice,
    ),
  );
  const copy = transferTask(root._id, { listId: to._id }, alice, true);
  assert.equal(copy.tasks.length, 3);
  assert.notEqual(copy.task._id, root._id);
  assert.notEqual(copy.task.attachments[0].url, url);
  assert.equal(copy.tasks[2].parentTaskId, copy.tasks[1]._id);
  assert.equal(rawTasks(from._id).length, 3);
  const moved = transferTask(
    child._id,
    { listId: to._id, parentTaskId: copy.task._id },
    alice,
  );
  assert.equal(moved.tasks.length, 2);
  assert.equal(getTask(grandchild._id, alice).listId, to._id);
  assert.equal(rawTasks(from._id).length, 1);
  db().prepare("DELETE FROM tasks WHERE id=?").run(copy.task._id);
  assert.throws(() => getTask(grandchild._id, alice));
});
test("account disabling revokes tokens, prevents OAuth login, and protects the last active admin", async () => {
  const { changeManagedUser } = await import("../lib/server/admin-users"),
    { byId } = await import("../lib/server/users"),
    { createToken, actorFromToken } = await import("../lib/server/tokens");
  const token = createToken({ name: "Revoke on disable" }, byId(bob)!);
  assert.throws(() =>
    changeManagedUser(alice, { active: false }, byId(alice)!),
  );
  changeManagedUser(bob, { active: false }, byId(alice)!);
  assert.throws(() =>
    actorFromToken(
      new Request("https://todo.example.test/api/v1/me", {
        headers: { Authorization: `Bearer ${token.token}` },
      }),
    ),
  );
  assert.equal(byId(bob)?.is_active, 0);
  assert.equal(
    db().prepare("SELECT id FROM api_tokens WHERE id=?").get(token.id),
    undefined,
  );
  changeManagedUser(bob, { active: true }, byId(alice)!);
  assert.equal(byId(bob)?.is_active, 1);
});
