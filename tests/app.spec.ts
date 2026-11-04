import { test, expect, type APIRequestContext } from "@playwright/test";
const origin = "http://localhost:3137",
  pass = "Strong test passphrase 2026!";
async function write(
  context: APIRequestContext,
  path: string,
  data: unknown,
  method = "POST",
) {
  return context.fetch(path, { method, headers: { Origin: origin }, data });
}
async function register(context: APIRequestContext, username: string) {
  const r = await write(context, "/api/account/register", {
    username,
    email: `${username}@example.test`,
    password: pass,
  });
  expect(r.status()).toBe(201);
}
async function login(
  context: APIRequestContext,
  username: string,
  password = pass,
) {
  const csrf = (await (await context.get("/api/auth/csrf")).json()).csrfToken;
  const r = await context.post("/api/auth/callback/credentials", {
    headers: { Origin: origin, "X-Auth-Return-Redirect": "1" },
    form: { csrfToken: csrf, login: username, password, callbackUrl: origin },
  });
  expect(r.ok()).toBeTruthy();
  return r.json();
}
test("registration, login, complete task workflow, permissions, recovery and mobile UI", async ({
  page,
  browser,
  playwright,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.waitForFunction(() =>
    ["light", "dark"].includes(document.documentElement.dataset.theme || ""),
  );
  await page.screenshot({
    path: "docs/screenshots/login-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Registrati", exact: true }).click();
  await expect(page).toHaveURL(/\/register/);
  await expect(
    page.getByRole("heading", { name: "Crea il tuo account", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("owner");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Account creato");
  await page.getByLabel("Username o email").fill("owner");
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Impostazioni", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Organizza il tuo prossimo progetto" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nuova lista", exact: true })
    .last()
    .click();
  const listDialog = page.getByRole("dialog", {
    name: "Nuova lista",
    exact: true,
  });
  await listDialog.getByLabel("Nome lista").fill("Progetti Ervisio");
  await expect(listDialog.getByLabel("Colore principale")).toHaveValue(
    "#b94406",
  );
  await expect(listDialog.getByLabel("Sfondo", { exact: true })).toHaveValue(
    "#ffffff",
  );
  await listDialog
    .getByRole("button", { name: "Salva lista", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Progetti Ervisio", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/l\/progetti-ervisio/);
  await page
    .getByRole("button", { name: "Nuova task", exact: true })
    .first()
    .click();
  const taskDialog = page.getByRole("dialog", {
    name: "Nuova task",
    exact: true,
  });
  await taskDialog
    .locator("input")
    .first()
    .fill("Preparare il rilascio standalone");
  await taskDialog
    .locator("textarea")
    .first()
    .fill("## Obiettivo\nVerificare il servizio e la persistenza dei dati.");
  await taskDialog
    .getByRole("button", { name: /Crea|Salva/ })
    .last()
    .click();
  await expect(
    page.getByText("Preparare il rilascio standalone", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/admin/todo/tasks/*/complete", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: "Servizio temporaneamente non disponibile",
      }),
    }),
  );
  await page.locator(".check-task").first().click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Servizio temporaneamente non disponibile" }),
  ).toContainText("Servizio temporaneamente non disponibile");
  await expect(
    page.getByText("Preparare il rilascio standalone", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/admin/todo/tasks/*/complete");
  await page.getByRole("button", { name: "Chiudi messaggio" }).click();
  const lists = await (await page.request.get("/api/admin/todo/lists")).json(),
    list = lists.data[0];
  const tasks = await (
      await page.request.get(`/api/admin/todo/tasks?listId=${list._id}`)
    ).json(),
    task = tasks.data[0];
  expect(list.slug).toBe("progetti-ervisio");
  expect(list.accentColor).toBe("#b94406");
  expect(list.backgroundColor).toBe("#ffffff");
  const tagResponse = await write(page.request, "/api/admin/todo/tags", {
      listId: list._id,
      name: "Rilascio",
      color: "#b94406",
    }),
    tag = (await tagResponse.json()).data;
  expect(tagResponse.status()).toBe(201);
  const childResponse = await write(page.request, "/api/admin/todo/tasks", {
    listId: list._id,
    parentTaskId: task._id,
    title: "Verificare Docker",
    tags: [tag._id],
  });
  expect(childResponse.status()).toBe(201);
  const child = (await childResponse.json()).data;
  await write(
    page.request,
    `/api/admin/todo/tasks/${task._id}/favorite`,
    {},
    "PATCH",
  );
  await page.reload();
  await expect(
    page.getByText("Preparare il rilascio standalone", { exact: true }),
  ).toBeVisible();
  // The subtask summary opens the detail panel, where subtasks form a checklist.
  await page
    .locator(`[data-task-row="${task._id}"]`)
    .getByRole("button", { name: /sottoattività/ })
    .click();
  const detail = page.getByRole("complementary", {
    name: "Dettaglio attività",
  });
  await expect(
    detail.getByText("Verificare Docker", { exact: true }),
  ).toBeVisible();
  // Regression: adding a grandchild updates the open checklist immediately.
  await detail.getByText("Verificare Docker", { exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "Verificare Docker", exact: true }),
  ).toBeVisible();
  await detail
    .getByRole("button", { name: "Aggiungi sottoattività", exact: true })
    .click();
  const nestedDialog = page.getByRole("dialog", {
    name: "Nuova task",
    exact: true,
  });
  await nestedDialog
    .locator("input")
    .first()
    .fill("Controllare i volumi senza refresh");
  await nestedDialog
    .getByRole("button", { name: /Crea|Salva/ })
    .last()
    .click();
  await expect(
    detail.getByText("Controllare i volumi senza refresh", { exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await page.screenshot({
    path: "docs/screenshots/workspace-desktop.png",
    fullPage: true,
  });
  const outsider = await playwright.request.newContext({ baseURL: origin }),
    member = await playwright.request.newContext({ baseURL: origin }),
    anonymous = await playwright.request.newContext({ baseURL: origin });
  await register(member, "member");
  await register(outsider, "outsider");
  await login(member, "member");
  await login(outsider, "outsider");
  expect((await anonymous.get("/api/admin/todo/lists")).status()).toBe(401);
  expect(
    (await outsider.get(`/api/admin/todo/tasks/${task._id}`)).status(),
  ).toBe(404);
  expect(
    (
      await write(
        outsider,
        `/api/admin/todo/tasks/${task._id}`,
        { title: "Hijack" },
        "PATCH",
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await write(outsider, `/api/admin/todo/lists/${list._id}`, {}, "DELETE")
    ).status(),
  ).toBe(404);
  expect((await outsider.get("/api/admin/settings")).status()).toBe(403);
  expect(
    (
      await page.request.patch(`/api/admin/todo/lists/${list._id}`, {
        headers: { Origin: "https://evil.example" },
        data: { title: "Hijack" },
      })
    ).status(),
  ).toBe(403);
  const found = (
    await (await page.request.get("/api/admin/users?q=member")).json()
  ).data[0];
  expect(found.email).toBeUndefined();
  expect(
    (
      await write(
        page.request,
        `/api/admin/todo/lists/${list._id}`,
        { members: [found._id] },
        "PATCH",
      )
    ).ok(),
  ).toBeTruthy();
  expect((await member.get(`/api/admin/todo/tasks/${task._id}`)).status()).toBe(
    200,
  );
  expect(
    (
      await write(
        member,
        `/api/admin/todo/lists/${list._id}`,
        { title: "Hijack" },
        "PATCH",
      )
    ).status(),
  ).toBe(404);
  const fileResponse = await page.request.post("/api/admin/upload", {
    headers: { Origin: origin },
    multipart: {
      listId: list._id,
      file: {
        name: "test.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("A private attachment"),
      },
    },
  });
  expect(fileResponse.status()).toBe(201);
  const fileUrl = (await fileResponse.json()).url;
  expect((await anonymous.get(fileUrl)).status()).toBe(401);
  expect((await outsider.get(fileUrl)).status()).toBe(404);
  expect((await member.get(fileUrl)).status()).toBe(200);
  expect(
    (
      await write(member, `/api/admin/todo/tasks/${task._id}/attachments`, {
        name: "test.txt",
        url: fileUrl,
        mimeType: "text/plain",
      })
    ).status(),
  ).toBe(200);
  await write(
    member,
    `/api/admin/todo/tasks/${task._id}/complete`,
    {},
    "PATCH",
  );
  expect(
    (await (await member.get(`/api/admin/todo/tasks/${child._id}`)).json()).data
      .isCompleted,
  ).toBe(true);
  await write(member, `/api/admin/todo/tasks/${child._id}/reopen`, {}, "PATCH");
  expect(
    (await (await member.get(`/api/admin/todo/tasks/${task._id}`)).json()).data
      .isCompleted,
  ).toBe(false);
  await write(
    page.request,
    `/api/admin/todo/lists/${list._id}`,
    { members: [] },
    "PATCH",
  );
  expect((await member.get(fileUrl)).status()).toBe(404);
  expect(
    (
      await write(
        page.request,
        "/api/admin/settings",
        { credentials: false },
        "PATCH",
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await write(
        page.request,
        "/api/admin/settings",
        { google: true },
        "PATCH",
      )
    ).status(),
  ).toBe(400);
  expect((await page.request.get("/api/auth/signin/google")).status()).toBe(
    403,
  );
  expect(
    (
      await page.request.get("/api/caddy/ask?domain=unknown.example.test")
    ).status(),
  ).toBe(403);
  expect(
    (await page.request.get("/api/caddy/ask?domain=localhost")).status(),
  ).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Progetti Ervisio", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/workspace-mobile.png",
    fullPage: true,
  });
  // SMTP is a real local test sink, with no external delivery.
  expect(
    (
      await write(outsider, "/api/account/forgot", {
        email: "outsider@example.test",
      })
    ).status(),
  ).toBe(200);
  const inbox = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:2528",
    }),
    messages = await (await inbox.get("/")).json();
  const mail = messages
      .join("\n")
      .replace(/=\r?\n/g, "")
      .replace(/=3D/g, "="),
    token = mail.match(/reset=([A-Za-z0-9_-]+)/)?.[1];
  expect(token).toBeTruthy();
  const reset = await write(anonymous, "/api/account/reset", {
    token,
    password: "Updated test passphrase 2026!",
  });
  expect(reset.status()).toBe(200);
  expect((await outsider.get("/api/admin/todo/lists")).status()).toBe(401);
  expect(
    (
      await write(anonymous, "/api/account/reset", { token, password: pass })
    ).status(),
  ).toBe(400);
  const wrong = await login(outsider, "outsider", pass);
  expect(wrong.url).toMatch(/error=/);
  const right = await login(
    outsider,
    "outsider",
    "Updated test passphrase 2026!",
  );
  expect(right.url).not.toMatch(/error=/);
  expect((await outsider.get("/api/admin/todo/lists")).status()).toBe(200);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page
    .getByRole("button", { name: "Nuovo progetto", exact: true })
    .first()
    .click();
  const projectDialog = page.getByRole("dialog", {
    name: "Nuovo progetto",
    exact: true,
  });
  await projectDialog.getByLabel("Nome progetto").fill("Rilascio Ervisio");
  await projectDialog
    .getByRole("button", { name: "Salva progetto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rilascio Ervisio", exact: true }),
  ).toBeVisible();
  const projectData = (
    await (await page.request.get("/api/admin/todo/projects")).json()
  ).data[0];
  await write(
    page.request,
    `/api/admin/todo/lists/${list._id}`,
    { projectId: projectData._id },
    "PATCH",
  );
  await page.reload();
  await page.getByRole("button", { name: "Schede", exact: true }).click();
  await expect(page.locator(".list-card")).toHaveCount(1);
  await expect(
    page.getByText("Preparare il rilascio standalone", { exact: true }),
  ).toBeVisible();
  for (const [title, slug, icon] of [
    ["Infrastruttura", "release-infra", "fa-solid fa-server"],
    ["Documentazione", "release-docs", "fa-solid fa-book-open"],
  ]) {
    const created = await write(page.request, "/api/admin/todo/lists", {
      title,
      slug,
      projectId: projectData._id,
      iconType: "fontawesome",
      iconValue: icon,
      accentColor: "#b94406",
      backgroundColor: "#ffffff",
    });
    expect(created.status()).toBe(201);
    const extra = (await created.json()).data;
    expect(
      (
        await write(page.request, "/api/admin/todo/tasks", {
          title:
            title === "Infrastruttura"
              ? "Configurare Caddy"
              : "Guida alla prima installazione",
          listId: extra._id,
        })
      ).status(),
    ).toBe(201);
  }
  await page.reload();
  await expect(page.locator(".list-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Riduci barra laterale", exact: true })
    .click();
  const projectIcon = page.getByRole("button", {
    name: "Rilascio Ervisio",
    exact: true,
  });
  await projectIcon.hover();
  await expect(page.getByRole("tooltip")).toContainText("Rilascio Ervisio");
  await page
    .getByRole("button", { name: "Espandi barra laterale", exact: true })
    .click();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/projects-desktop.png",
    fullPage: true,
  });
  // Bearer scopes and workspace switches apply immediately without blocking browser sessions.
  const tokenResponse = await write(page.request, "/api/admin/tokens", {
    name: "Read automation",
    scopes: ["read"],
    lifetimeDays: 1,
  });
  expect(tokenResponse.status()).toBe(201);
  const apiToken = (await tokenResponse.json()).data;
  const tokenClient = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${apiToken.token}` },
  });
  expect((await tokenClient.get("/api/admin/todo/lists")).status()).toBe(200);
  expect(
    (
      await tokenClient.post("/api/admin/todo/tasks", {
        data: { title: "No write scope", listId: list._id },
      })
    ).status(),
  ).toBe(403);
  await write(
    page.request,
    "/api/admin/settings",
    { apiEnabled: false },
    "PATCH",
  );
  expect((await tokenClient.get("/api/admin/todo/lists")).status()).toBe(403);
  expect((await page.request.get("/api/admin/todo/lists")).status()).toBe(200);
  await write(
    page.request,
    "/api/admin/settings",
    { apiEnabled: true, maxFilesPerUpload: 1 },
    "PATCH",
  );
  const tooManyFiles = await page.request.post("/api/admin/upload", {
    headers: { Origin: origin },
    multipart: {
      file: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("a") },
      files: {
        name: "b.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("b"),
      },
    },
  });
  expect(tooManyFiles.status()).toBe(400);
  const shareResponse = await write(
    page.request,
    `/api/admin/todo/lists/${list._id}/shares`,
    { lifetimeHours: 24 },
  );
  expect(shareResponse.status()).toBe(201);
  const share = (await shareResponse.json()).data;
  const shared = (
    await (await anonymous.get(`/api/shared/${share.token}`)).json()
  ).data;
  expect(shared.tasks.length).toBeGreaterThan(0);
  expect(shared.tasks[0].attachments).toBeUndefined();
  expect(shared.tasks[0].assignedTo).toBeUndefined();
  await write(
    page.request,
    "/api/admin/settings",
    { sharingEnabled: false },
    "PATCH",
  );
  expect((await anonymous.get(`/api/shared/${share.token}`)).status()).toBe(
    404,
  );
  await write(
    page.request,
    "/api/admin/settings",
    { sharingEnabled: true, maxFilesPerUpload: 0 },
    "PATCH",
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Generali", exact: true }).click();
  await page.getByLabel("Nome dello spazio").fill("Ervisio Workspace");
  await page
    .getByRole("button", { name: "Salva impostazioni", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Impostazioni salvate");
  await page
    .getByRole("button", { name: "Spazio e limiti", exact: true })
    .click();
  await expect(
    page.getByText("Dimensione massima allegato", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/settings-limits.png",
    fullPage: true,
  });
  await page.getByLabel("Lingua", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language", { exact: true }).selectOption("it");
  await page.goto(`/p/${projectData.slug}`);
  await page.getByRole("button", { name: "Schede", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/projects-cards.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Apri menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rilascio Ervisio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chiudi menu", exact: true }).click();
  const cards = await page.locator(".list-card").all();
  for (let i = 1; i < cards.length; i++) {
    const previous = await cards[i - 1].boundingBox(),
      current = await cards[i].boundingBox();
    expect(previous!.y + previous!.height).toBeLessThanOrEqual(current!.y);
  }
  await page.screenshot({
    path: "docs/screenshots/projects-mobile.png",
    fullPage: true,
  });
  await tokenClient.dispose();
  expect(errors).toEqual([]);
  await outsider.dispose();
  await member.dispose();
  await anonymous.dispose();
  await inbox.dispose();
});

test("versioned API manages complete resources and enforces scope, membership, pagination and revocation", async ({
  playwright,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  const signIn = await anonymous.post("/api/v1/auth/login", {
    data: { login: "owner", password: pass, name: "Integration test" },
  });
  expect(signIn.status()).toBe(201);
  const key = (await signIn.json()).data.token,
    client = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Authorization: `Bearer ${key}` },
    });
  async function call(
    path: string,
    data?: unknown,
    method = data ? "POST" : "GET",
    status = method === "POST" ? 201 : 200,
  ) {
    const response = await client.fetch("/api/v1" + path, {
      method,
      ...(data !== undefined ? { data } : {}),
    });
    const json = await response.json();
    expect(response.status(), JSON.stringify(json)).toBe(status);
    return json.data;
  }
  const me = await call("/me");
  expect(me.user.role).toBe("admin");
  expect(me.user).not.toHaveProperty("password");
  expect((await anonymous.get("/api/v1/projects")).status()).toBe(401);
  const project = await call("/projects", {
      title: "API project",
      slug: "api-project",
    }),
    list = await call("/lists", {
      title: "API list",
      slug: "api-list",
      projectId: project._id,
    }),
    other = await call("/lists", {
      title: "API destination",
      slug: "api-destination",
    });
  expect(
    (await call(`/projects/${project._id}/lists`)).some(
      (item: any) => item._id === list._id,
    ),
  ).toBe(true);
  const tag = await call("/tags", {
    listId: list._id,
    name: "API",
    color: "#b94406",
  });
  expect((await call(`/tags/${tag._id}`)).name).toBe("API");
  await call(`/tags/${tag._id}`, { name: "Automation" }, "PATCH");
  const root = await call("/tasks", {
      listId: list._id,
      title: "Root API",
      description: "Keep this",
      tags: [tag._id],
    }),
    child = await call("/tasks", {
      listId: list._id,
      parentTaskId: root._id,
      title: "Child API",
    }),
    leaf = await call("/tasks", {
      listId: list._id,
      parentTaskId: child._id,
      title: "Leaf API",
    });
  await call(`/tasks/${root._id}`, { title: "Renamed" }, "PATCH");
  expect((await call(`/tasks/${root._id}`)).description).toBe("Keep this");
  const paginated = await client.get(
    `/api/v1/lists/${list._id}/tasks?limit=1&offset=1`,
  );
  const pageJson = await paginated.json();
  expect(pageJson.pagination).toMatchObject({
    total: 3,
    limit: 1,
    offset: 1,
    hasMore: true,
  });
  expect(pageJson.data).toHaveLength(1);
  expect((await client.get("/api/v1/lists?limit=-1")).status()).toBe(400);
  await call(
    "/tasks/reorder",
    { ids: [leaf._id, child._id, root._id] },
    "POST",
    200,
  );
  await call(`/tasks/${root._id}/complete`, {}, "PATCH");
  expect((await call(`/tasks/${leaf._id}`)).isCompleted).toBe(true);
  await call(`/tasks/${leaf._id}/reopen`, {}, "PATCH");
  expect((await call(`/tasks/${root._id}`)).isCompleted).toBe(false);
  const upload = await client.post("/api/v1/files/upload", {
    multipart: {
      listId: list._id,
      file: {
        name: "api.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("API private content"),
      },
    },
  });
  expect(upload.status()).toBe(201);
  const fileUrl = (await upload.json()).data.files[0].url,
    fileId = fileUrl.split("/").pop()!;
  await call(
    `/tasks/${root._id}/attachments`,
    { url: fileUrl, name: "api.txt", mimeType: "text/plain" },
    "POST",
    200,
  );
  expect((await call(`/files/${fileId}`)).size).toBe(19);
  await call(`/files/${fileId}`, { name: "renamed.txt" }, "PATCH");
  expect((await client.get(`/api/v1/files/${fileId}/download`)).status()).toBe(
    200,
  );
  expect((await call(`/tasks/${root._id}`)).attachments[0].name).toBe(
    "renamed.txt",
  );
  const copy = await call(`/tasks/${root._id}/copy`, { listId: other._id });
  expect(copy.tasks).toHaveLength(3);
  expect(copy.task.attachments[0].url).not.toBe(fileUrl);
  await call(`/tasks/${child._id}/move`, { listId: other._id }, "POST", 200);
  expect((await call(`/tasks/${leaf._id}`)).listId).toBe(other._id);
  const batch = await call(
    "/tasks/bulk",
    { ids: [root._id, "missing"], action: "complete" },
    "POST",
    200,
  );
  expect(batch.results.map((item: any) => item.success)).toEqual([true, false]);
  const scoped = await call("/tokens", {
    name: "Limited",
    scopes: ["tasks:read", "lists:read", "tokens:write", "files:read"],
    resourceMode: "selected",
    listIds: [list._id],
  });
  const limited = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${scoped.token}` },
  });
  expect((await limited.get("/api/v1/lists")).ok()).toBe(true);
  expect(
    (await (await limited.get("/api/v1/lists")).json()).data.map(
      (item: any) => item._id,
    ),
  ).toEqual([list._id]);
  expect((await limited.get(`/api/v1/lists/${other._id}`)).status()).toBe(404);
  expect((await limited.get(copy.task.attachments[0].url)).status()).toBe(404);
  expect(
    (await limited.get(`/api/admin/todo/tasks/${leaf._id}`)).status(),
  ).toBe(404);
  expect((await limited.get("/api/v1/settings")).status()).toBe(403);
  expect(
    (
      await limited.post("/api/v1/tasks", {
        data: { title: "Forbidden", listId: list._id },
      })
    ).status(),
  ).toBe(403);
  const derived = await limited.post("/api/v1/tokens", {
    data: { name: "Derived", scopes: ["lists:read"], resourceMode: "all" },
  });
  expect(derived.status()).toBe(201);
  const childKey = (await derived.json()).data;
  const derivedClient = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Authorization: `Bearer ${childKey.token}` },
  });
  expect((await derivedClient.get(`/api/v1/lists/${other._id}`)).status()).toBe(
    404,
  );
  await call(`/tokens/${scoped.id}`, undefined, "DELETE");
  expect((await derivedClient.get("/api/v1/lists")).status()).toBe(401);
  const user = await call("/users", {
    username: "api_member",
    email: "api_member@example.test",
    password: pass,
  });
  await call(`/projects/${project._id}/members`, { members: [user.id] }, "PUT");
  expect(
    (await call(`/projects/${project._id}/members`)).effective.map(
      (member: any) => member._id,
    ),
  ).toContain(user.id);
  await call(`/lists/${list._id}/members`, { members: [user.id] }, "PUT");
  const memberLogin = await anonymous.post("/api/v1/auth/login", {
    data: { login: "api_member", password: pass },
  });
  expect(memberLogin.status()).toBe(201);
  const memberClient = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: {
      Authorization: `Bearer ${(await memberLogin.json()).data.token}`,
    },
  });
  expect((await memberClient.get(`/api/v1/lists/${list._id}`)).status()).toBe(
    200,
  );
  expect((await memberClient.get("/api/v1/users")).status()).toBe(403);
  await call(`/users/${user.id}`, undefined, "DELETE");
  expect((await memberClient.get("/api/v1/me")).status()).toBe(401);
  expect(
    (
      await anonymous.post("/api/v1/auth/login", {
        data: { login: "api_member", password: pass },
      })
    ).status(),
  ).toBe(401);
  expect((await client.delete(`/api/v1/users/${me.user.id}`)).status()).toBe(
    400,
  );
  const share = await call(`/lists/${list._id}/shares`, { lifetimeHours: 1 });
  expect((await anonymous.get(`/api/shared/${share.token}`)).status()).toBe(
    200,
  );
  await call(`/lists/${list._id}/shares/${share.id}`, undefined, "DELETE");
  expect((await anonymous.get(`/api/shared/${share.token}`)).status()).toBe(
    404,
  );
  await call(`/files/${fileId}`, undefined, "DELETE");
  expect((await call(`/tasks/${root._id}`)).attachments).toHaveLength(0);
  expect((await client.get(fileUrl)).status()).toBe(404);
  const spec = await (await anonymous.get("/api/openapi.json")).json();
  expect(spec.openapi).toBe("3.1.0");
  expect(spec.paths["/api/v1/tasks/{id}/copy"].post).toBeTruthy();
  const collection = await (await anonymous.get("/api/postman.json")).json();
  expect(collection.item.length).toBeGreaterThan(10);
  await call("/settings", { apiRequestsPerMinute: 0 }, "PATCH");
  await call("/usage");
  await call("/activity");
  await login(page.request, "owner");
  await page.goto("/api-docs");
  await expect(
    page.getByRole("heading", { name: "Ogni operazione, via API." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/api-docs.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await call("/auth/logout", {}, "POST", 200);
  expect((await client.get("/api/v1/me")).status()).toBe(401);
  await Promise.all([
    anonymous.dispose(),
    client.dispose(),
    limited.dispose(),
    derivedClient.dispose(),
    memberClient.dispose(),
  ]);
});

test("themes stay consistent across lists, navigation and reload; custom themes can be created and exported", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await register(page.request, "theme_user");
  await login(page.request, "theme_user");
  const list = await (
    await write(page.request, "/api/admin/todo/lists", {
      title: "Theme regression",
      slug: "theme-regression",
      backgroundColor: "#131a22",
      accentColor: "#69a9e9",
    })
  ).json();
  await write(page.request, "/api/admin/todo/tasks", {
    listId: list.data._id,
    title: "Controllare i temi",
  });
  await page.goto("/settings");
  await expect(page.getByLabel("Tema", { exact: true })).toBeVisible();
  await page.getByLabel("Tema", { exact: true }).selectOption("light");
  await page.goto("/l/theme-regression");
  await expect(
    page.getByText("Controllare i temi", { exact: true }),
  ).toBeVisible();
  async function colors() {
    return page.evaluate(() => {
      const style = getComputedStyle(document.documentElement),
        surface = document.querySelector(".task-surface")!,
        selector = document
          .querySelector(".view-selector")!
          .getBoundingClientRect(),
        row = document
          .querySelector(".workspace-view-row")!
          .getBoundingClientRect();
      return {
        sheet: style.getPropertyValue("--sheet").trim(),
        surface: getComputedStyle(surface).backgroundColor,
        fg: getComputedStyle(surface).color,
        accent: style.getPropertyValue("--accent").trim(),
        right: row.right - selector.right,
        selected: getComputedStyle(
          document.querySelector(".sidebar-list.active")!,
        ).backgroundColor,
        palette: document.documentElement.dataset.palette,
      };
    });
  }
  expect(await colors()).toMatchObject({
    sheet: "#ffffff",
    surface: "rgb(255, 255, 255)",
    accent: "#245ac2",
  });
  expect((await colors()).selected).not.toBe("rgba(0, 0, 0, 0)");
  expect((await colors()).right).toBeLessThan(2);
  for (const [id, sheet] of [
    ["dark", "#202631"],
    ["amoled", "#000000"],
    ["tokyo-night", "#1a1b26"],
    ["github-dark", "#0d1117"],
    ["dracula", "#282a36"],
    ["catppuccin-mocha", "#1e1e2e"],
    ["nord", "#3b4252"],
    ["solarized-light", "#fdf6e3"],
  ]) {
    await page.goto("/settings");
    await page.getByLabel("Tema", { exact: true }).selectOption(id);
    await page.goto("/l/theme-regression");
    await expect(
      page.getByText("Controllare i temi", { exact: true }),
    ).toBeVisible();
    expect(await colors()).toMatchObject({ sheet, palette: id });
    await page.screenshot({
      path: `docs/screenshots/theme-${id}.png`,
      fullPage: true,
    });
  }
  await page.goto("/settings");
  await page.getByLabel("Tema", { exact: true }).selectOption("amoled");
  await page
    .getByLabel("Colore accento personale", { exact: true })
    .fill("#00d4ff");
  await page
    .getByRole("button", {
      name: "Seleziona Colore accento personale",
      exact: true,
    })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Colore accento personale: selettore",
  });
  await expect(picker).toBeVisible();
  await picker
    .getByRole("slider", { name: "Saturazione e luminosità" })
    .focus();
  await page.keyboard.press("ArrowLeft");
  await page
    .getByRole("button", { name: "Chiudi selettore colore", exact: true })
    .click();
  await page
    .getByLabel("Colore accento personale", { exact: true })
    .fill("#00d4ff");
  await page.reload();
  await expect(
    page.getByLabel("Colore accento personale", { exact: true }),
  ).toHaveValue("#00d4ff");
  await page.getByRole("button", { name: "Crea tema", exact: true }).click();
  const editor = page.getByRole("form", { name: "Editor tema personalizzato" });
  await editor.getByLabel("Nome tema", { exact: true }).fill("Notte personale");
  await editor.getByLabel("Sfondo pagina", { exact: true }).fill("#07111f");
  await editor.getByLabel("Pannelli e liste", { exact: true }).fill("#0d1b2a");
  await editor.getByRole("button", { name: "Salva tema", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Tema salvato.");
  await page.screenshot({
    path: "docs/screenshots/theme-custom-desktop.png",
    fullPage: true,
  });
  const customId = await page.getByLabel("Tema", { exact: true }).inputValue();
  expect(customId).toMatch(/^custom-/);
  await page.goto("/l/theme-regression");
  await expect(
    page.getByText("Controllare i temi", { exact: true }),
  ).toBeVisible();
  expect(await colors()).toMatchObject({
    sheet: "#0d1b2a",
    surface: "rgb(13, 27, 42)",
    accent: "#00d4ff",
    palette: customId,
  });
  await page.reload();
  await expect(
    page.getByText("Controllare i temi", { exact: true }),
  ).toBeVisible();
  expect(await colors()).toMatchObject({ sheet: "#0d1b2a", palette: customId });
  await page.getByText("Controllare i temi", { exact: true }).click();
  const detail = page.getByRole("complementary", {
    name: /Dettaglio attività/,
  });
  await expect(detail).toBeVisible();
  expect(
    await detail.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgb(7, 17, 31)");
  await detail.getByRole("button", { name: "Chiudi", exact: true }).click();
  await page.goto("/settings");
  await page
    .getByRole("button", {
      name: "Modifica tema: Notte personale",
      exact: true,
    })
    .click();
  await editor
    .getByLabel("Nome tema", { exact: true })
    .fill("Notte modificata");
  await editor.getByRole("button", { name: "Salva tema", exact: true }).click();
  await expect(page.getByLabel("Tema", { exact: true })).toHaveValue(customId);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta temi", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ervisio-todo-temi.json");
  await page.getByLabel("Usa i colori delle liste", { exact: true }).check();
  await page.goto("/l/theme-regression");
  await expect(
    page.getByText("Controllare i temi", { exact: true }),
  ).toBeVisible();
  expect((await colors()).surface).toBe("rgb(19, 26, 34)");
  expect((await colors()).accent).toBe("#00d4ff");
  await page.goto("/settings");
  await page.getByLabel("Usa i colori delle liste", { exact: true }).uncheck();
  await page.getByLabel("Tema", { exact: true }).selectOption("tokyo-night");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel("Tema", { exact: true })).toHaveValue(
    "tokyo-night",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/theme-settings-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
