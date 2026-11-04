import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDB } from "../lib/server/db";
import { GET as statusGet } from "../app/api/plugin/status/route";
import {
  GET as settingsGet,
  PUT as settingsPut,
} from "../app/api/plugin/settings/route";
import { POST as mailTest } from "../app/api/plugin/mail/test/route";
import {
  createPluginProxy,
  startPluginSocket,
} from "../scripts/plugin-socket.mjs";

const SECRET = "a".repeat(64);
let directory: string;
before(() => {
  directory = mkdtempSync(join(tmpdir(), "ervisio-plugin-"));
  process.env.DATA_DIR = directory;
  process.env.AUTH_URL = "https://todo.example.test";
  delete process.env.SMTP_URL;
  process.env.PLUGIN_SECRET = SECRET;
});
after(() => {
  closeDB();
  rmSync(directory, { recursive: true, force: true });
});

const call = (
  handler: (request: Request) => Promise<Response>,
  method: string,
  secret?: string,
  body?: unknown,
) =>
  handler(
    new Request("http://localhost/api/plugin/x", {
      method,
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-ervisio-plugin": secret } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

test("guard answers 404 without or with a wrong secret", async () => {
  for (const secret of [undefined, "wrong", SECRET.slice(1), SECRET + "a"]) {
    assert.equal((await call(statusGet, "GET", secret)).status, 404);
    assert.equal((await call(settingsGet, "GET", secret)).status, 404);
    assert.equal(
      (await call(settingsPut, "PUT", secret, { values: {} })).status,
      404,
    );
    assert.equal(
      (await call(mailTest, "POST", secret, { to: "a@b.test" })).status,
      404,
    );
  }
  delete process.env.PLUGIN_SECRET;
  try {
    assert.equal((await call(statusGet, "GET", SECRET)).status, 404);
  } finally {
    process.env.PLUGIN_SECRET = SECRET;
  }
});

test("status has the contract shape", async () => {
  const response = await call(statusGet, "GET", SECRET);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.version, "0.3.0");
  assert.equal(body.publicUrl, "https://todo.example.test");
  assert.equal(body.restartRequired, false);
  assert.equal(body.mailEnabled, false);
  assert.ok(!Number.isNaN(Date.parse(body.startedAt)));
  assert.deepEqual(Object.keys(body.providers).sort(), [
    "cognito",
    "credentials",
    "discord",
    "google",
  ]);
  assert.deepEqual(body.counts, { users: 0, lists: 0, tasks: 0, openTasks: 0 });
  assert.equal(typeof body.storage.usedBytes, "number");
  assert.equal(body.storage.quotaBytes, null);
});

test("settings GET returns values, defaults and configured providers", async () => {
  const body = await (await call(settingsGet, "GET", SECRET)).json();
  assert.equal(body.restartRequired, false);
  assert.equal(body.values.siteName, "ErvisioTodo");
  assert.equal(body.defaults.siteName, "ErvisioTodo");
  assert.equal(body.values.credentials, true);
  assert.equal(body.values.registration, true);
  assert.deepEqual(Object.keys(body.configured).sort(), [
    "cognito",
    "discord",
    "google",
  ]);
});

test("settings PUT saves valid changes and reports 422 for invalid ones", async () => {
  const saved = await call(settingsPut, "PUT", SECRET, {
    values: { siteName: "Team tasks", sharingEnabled: false },
  });
  assert.equal(saved.status, 200);
  const values = (await saved.json()).values;
  assert.equal(values.siteName, "Team tasks");
  assert.equal(values.sharingEnabled, false);

  const invalid = await call(settingsPut, "PUT", SECRET, {
    values: { siteName: "", defaultLocale: "fr", nope: 1 },
  });
  assert.equal(invalid.status, 422);
  assert.match(
    invalid.headers.get("content-type") ?? "",
    /application\/problem\+json/,
  );
  const problem = await invalid.json();
  assert.equal(problem.status, 422);
  const paths = problem.errors.map((e: { path: string }) => e.path);
  assert.ok(paths.includes("siteName"), paths.join());
  assert.ok(paths.includes("nope"), paths.join());

  const policy = await call(settingsPut, "PUT", SECRET, {
    values: { credentials: false },
  });
  assert.equal(policy.status, 422);
  assert.equal((await policy.json()).errors[0].path, "");

  assert.equal((await call(settingsPut, "PUT", SECRET, {})).status, 422);
  const current = await (await call(settingsGet, "GET", SECRET)).json();
  assert.equal(current.values.siteName, "Team tasks");
});

test("mail test needs SMTP_URL and a valid recipient", async () => {
  const missing = await call(mailTest, "POST", SECRET, { to: "a@b.test" });
  assert.equal(missing.status, 422);
  process.env.SMTP_URL = "smtp://127.0.0.1:1";
  try {
    const invalid = await call(mailTest, "POST", SECRET, { to: "nope" });
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).errors[0].path, "to");
  } finally {
    delete process.env.SMTP_URL;
  }
});

test("other methods answer 404 without the secret and 405 with it", async () => {
  const route = await import("../app/api/plugin/status/route");
  assert.equal((await call(route.DELETE, "DELETE")).status, 404);
  assert.equal((await call(route.DELETE, "DELETE", SECRET)).status, 405);
});

type Seen = { url?: string; secret?: string | string[]; size: number };
type Reply = { status: number; body: string; type?: string };

function dummyUpstream(seen: Seen[]) {
  return http.createServer((req, res) => {
    let size = 0;
    req.on("data", (chunk) => (size += chunk.length));
    req.on("end", () => {
      seen.push({
        url: req.url,
        secret: req.headers["x-ervisio-plugin"],
        size,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    });
  });
}

const listen = (server: http.Server, ...args: unknown[]) =>
  new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    (server.listen as (...a: unknown[]) => void)(...args, resolve);
  });
const shut = (server: http.Server) =>
  new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });

function requester(target: http.RequestOptions) {
  return (path: string, body?: Buffer, headers = {}) =>
    new Promise<Reply>((resolve, reject) => {
      const req = http.request(
        { ...target, path, method: body ? "POST" : "GET", headers },
        (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () =>
            resolve({
              status: res.statusCode ?? 0,
              body: text,
              type: res.headers["content-type"],
            }),
          );
        },
      );
      req.on("error", reject);
      req.end(body);
    });
}

async function exercise(request: ReturnType<typeof requester>, seen: Seen[]) {
  const ok = await request("/api/plugin/status", undefined, {
    "x-ervisio-plugin": "forged",
  });
  assert.equal(ok.status, 200);
  assert.equal(seen[0].url, "/api/plugin/status");
  assert.equal(seen[0].secret, "s".repeat(64));

  const other = await request("/api/health");
  assert.equal(other.status, 404);
  assert.equal(other.type, "application/problem+json");
  assert.equal((await request("/api/plugin/../health")).status, 404);
  assert.equal((await request("/api/pluginx")).status, 404);
  assert.equal(seen.length, 1);

  const exact = await request(
    "/api/plugin/settings",
    Buffer.alloc(1024 * 1024),
  );
  assert.equal(exact.status, 200);
  assert.equal(seen[1].size, 1024 * 1024);
  const big = await request(
    "/api/plugin/settings",
    Buffer.alloc(1024 * 1024 + 1),
  );
  assert.equal(big.status, 413);
  assert.equal(big.type, "application/problem+json");
  assert.equal(JSON.parse(big.body).status, 413);
}

test("proxy forwards only plugin paths, replaces the secret and caps bodies", async () => {
  const seen: Seen[] = [],
    upstream = dummyUpstream(seen);
  await listen(upstream, 0, "127.0.0.1");
  const proxy = createPluginProxy({
    secret: "s".repeat(64),
    upstreamPort: (upstream.address() as { port: number }).port,
  });
  await listen(proxy, 0, "127.0.0.1");
  try {
    await exercise(
      requester({
        host: "127.0.0.1",
        port: (proxy.address() as { port: number }).port,
      }),
      seen,
    );
  } finally {
    await shut(proxy);
    await shut(upstream);
  }
});

test("unix socket listener serves the proxy and sets PLUGIN_SECRET", async (t) => {
  const seen: Seen[] = [],
    upstream = dummyUpstream(seen);
  await listen(upstream, 0, "127.0.0.1");
  const socketPath = join(directory, "api.sock");
  let handle: Awaited<ReturnType<typeof startPluginSocket>>;
  try {
    handle = await startPluginSocket({
      path: socketPath,
      upstreamPort: (upstream.address() as { port: number }).port,
      secret: "s".repeat(64),
    });
  } catch (error) {
    await shut(upstream);
    if (process.platform === "win32") {
      t.skip(
        `AF_UNIX listen not permitted on this Windows host: ${(error as Error).message}`,
      );
      return;
    }
    throw error;
  } finally {
    process.env.PLUGIN_SECRET = SECRET;
  }
  try {
    assert.ok(handle);
    await exercise(requester({ socketPath }), seen);
  } finally {
    await handle?.close();
    await shut(upstream);
  }
});
