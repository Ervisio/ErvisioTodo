import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const suffix = randomBytes(4).toString("hex"),
  app = `ervis-test-app-${suffix}`,
  caddy = `ervis-test-caddy-${suffix}`,
  volume = `ervis-test-data-${suffix}`,
  network = `ervis-test-net-${suffix}`;
const canonical = "https://todo.example.test:3443",
  subdomain = "https://delivery.example.test:3443",
  apiBase = "http://localhost:3138";
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let browser;
async function request(path, body, token) {
  const r = await fetch(apiBase + path, {
    method: body ? "POST" : "GET",
    headers: {
      Host: "todo.example.test:3443",
      Origin: canonical,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Cookie: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r;
}
try {
  docker("network", "create", network);
  docker(
    "run",
    "-d",
    "--name",
    app,
    "--network",
    network,
    "--network-alias",
    "app",
    "-e",
    `AUTH_SECRET=${randomBytes(48).toString("base64url")}`,
    "-e",
    `AUTH_URL=${canonical}`,
    "-e",
    "BASE_DOMAIN=example.test",
    "-e",
    "AUTH_COOKIE_DOMAIN=.example.test",
    "-e",
    "TRUSTED_IP_HEADER=X-Real-IP",
    "-p",
    "127.0.0.1:3138:3000",
    "-v",
    `${volume}:/app/data`,
    "ervisio-todo:local",
  );
  for (let i = 0; i < 40; i++) {
    try {
      if ((await request("/api/health")).ok) break;
    } catch {}
    await pause(500);
  }
  assert.equal((await request("/api/health")).status, 200);
  docker(
    "run",
    "-d",
    "--name",
    caddy,
    "--network",
    network,
    "-p",
    "127.0.0.1:3443:443",
    "-v",
    `${resolve("tests/fixtures/Caddyfile")}:/etc/caddy/Caddyfile:ro`,
    "caddy:2",
  );
  await pause(800);
  browser = await chromium.launch({
    args: [
      "--host-resolver-rules=MAP *.example.test 127.0.0.1",
      "--no-proxy-server",
    ],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(canonical + "/register");
  await page.getByLabel("Username", { exact: true }).fill("dockerowner");
  await page
    .getByLabel("Email", { exact: true })
    .fill("dockerowner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Docker smoke test passphrase!");
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await page.getByRole("status").waitFor();
  await page.getByLabel("Username o email").fill("dockerowner");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Docker smoke test passphrase!");
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(canonical + "/");
  const cookies = await context.cookies();
  assert.ok(
    cookies.some(
      (c) =>
        c.name === "__Secure-ervisio.session-token" &&
        c.domain === ".example.test" &&
        c.secure &&
        c.httpOnly,
    ),
  );
  await page
    .getByRole("button", { name: "Nuova lista", exact: true })
    .last()
    .click();
  const dialog = page.getByRole("dialog", { name: "Nuova lista", exact: true });
  await dialog.getByLabel("Nome lista").fill("Delivery Ervisio");
  await dialog.getByLabel("Sottodominio", { exact: true }).fill("delivery");
  await dialog.getByLabel("Colore principale").fill("#60b5a2");
  await dialog.getByLabel("Sfondo", { exact: true }).fill("#142625");
  await dialog
    .getByRole("button", { name: "Salva lista", exact: true })
    .click();
  await page.waitForURL(canonical + "/l/delivery-ervisio");
  const session = cookies
    .filter((c) => c.name === "__Secure-ervisio.session-token")
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const all = await (
      await request("/api/admin/todo/lists", undefined, session)
    ).json(),
    list = all.data[0];
  const favicon = await page.evaluate(async () => {
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    const form = new FormData();
    form.append("file", new File([png], "favicon.png", { type: "image/png" }));
    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: form,
    });
    return (await response.json()).url;
  });
  const branded = await page.evaluate(
    async ({ id, url }) => {
      const response = await fetch(`/api/admin/todo/lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iconType: "image",
          iconValue: url,
          faviconUrl: url,
        }),
      });
      return response.status;
    },
    { id: list._id, url: favicon },
  );
  assert.equal(branded, 200);
  assert.equal((await request(favicon)).status, 200);
  assert.equal(list.accentColor, "#60b5a2");
  assert.equal(list.subdomain, "delivery");
  assert.equal(
    (await request("/api/caddy/ask?domain=delivery.example.test")).status,
    200,
  );
  assert.equal(
    (await request("/api/caddy/ask?domain=unknown.example.test")).status,
    403,
  );
  await page.goto(subdomain);
  await page
    .getByRole("heading", { name: "Delivery Ervisio", exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).hostname, "delivery.example.test");
  assert.equal(await page.title(), "Delivery Ervisio · ErvisioTodo");
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim(),
    ),
    "#b94406",
  );
  await page
    .getByRole("button", { name: "Nuova task", exact: true })
    .first()
    .click();
  const taskDialog = page.getByRole("dialog", {
    name: "Nuova task",
    exact: true,
  });
  await taskDialog.locator("input").first().fill("Persistenza dopo riavvio");
  await taskDialog
    .getByRole("button", { name: /Crea|Salva/ })
    .last()
    .click();
  await page.getByText("Persistenza dopo riavvio", { exact: true }).waitFor();
  docker("restart", app);
  for (let i = 0; i < 40; i++) {
    try {
      if ((await request("/api/health")).ok) break;
    } catch {}
    await pause(500);
  }
  await page.reload();
  await page.getByText("Persistenza dopo riavvio", { exact: true }).waitFor();
  assert.equal(
    await page.locator('link[rel="icon"]').first().getAttribute("href"),
    favicon,
  );
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: "docs/screenshots/docker-caddy-https.png",
    fullPage: true,
  });
  console.log(
    "PASS: Docker production, Caddy HTTPS (local CA), secure SSO cookie, per-list subdomain/theme, authenticated writes, persisted data and session after container restart.",
  );
} catch (e) {
  try {
    console.error(docker("logs", "--tail", "30", app));
    console.error(docker("logs", "--tail", "20", caddy));
  } catch {}
  throw e;
} finally {
  await browser?.close();
  for (const name of [app, caddy])
    try {
      docker("rm", "-f", name);
    } catch {}
  try {
    docker("volume", "rm", volume);
  } catch {}
  try {
    docker("network", "rm", network);
  } catch {}
}
