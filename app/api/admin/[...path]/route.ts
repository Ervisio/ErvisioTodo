import { z } from "zod";
import { api, requireUser, success } from "@/lib/server/http";
import {
  assertOrigin,
  insist,
  jsonBody,
  rateLimit,
} from "@/lib/server/security";
import { db, transaction } from "@/lib/server/db";
import {
  authSettings,
  providerConfigured,
  publicConfig,
} from "@/lib/server/config";
import { byLogin, publicUser, byId } from "@/lib/server/users";
import { uploadFiles } from "@/lib/server/files";
import {
  getList,
  listsFor,
  saveList,
  getTask,
  tasksFor,
  saveTask,
  setTaskState,
  reorderTasks,
  tagsFor,
  saveTag,
  deleteTag,
  rawTasks,
  attachmentUpdate,
  caddySnippet,
  enrichTask,
  listMemberIds,
} from "@/lib/server/todo";
import { aiGenerate, aiRefactor } from "@/lib/server/ai";
import {
  projectsFor,
  saveProject,
  getProject,
  deleteProject,
} from "@/lib/server/projects";
import {
  workspaceSettings,
  saveSettings,
  settingsEnvironment,
  storageUsage,
  pruneActivity,
  recordActivity,
} from "@/lib/server/settings";
import { tokensFor, createToken, deleteToken } from "@/lib/server/tokens";
import { sharesFor, createShare, deleteShare } from "@/lib/server/shares";
import { actorContext } from "@/lib/server/api-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  let actorId: string | undefined;
  const response = await api(async () => {
    const user = await requireUser(request),
      { path } = await context.params;
    return actorContext.run(user, async () => {
      actorId = user.id;
      const method = request.method,
        url = new URL(request.url),
        q = url.searchParams;
      if (method !== "GET") {
        if (!user.tokenId) assertOrigin(request);
        const limit = workspaceSettings().writeRequestsPerMinute;
        if (limit > 0) rateLimit(`write:${user.id}`, limit, 60_000);
      }
      const route = path.join("/");
      if (route === "settings") {
        insist(user.role === "admin", 403, "Solo amministratori");
        if (method === "PATCH") {
          saveSettings(await jsonBody(request));
          recordActivity(user.id, "settings.update");
        } else insist(method === "GET", 405, "Metodo non consentito");
        return success({
          settings: authSettings(),
          workspace: workspaceSettings(),
          configured: providerConfigured(),
          environment: settingsEnvironment(),
          usage: storageUsage(),
          ...publicConfig(),
        });
      }
      if (route === "activity" && method === "GET") {
        insist(user.role === "admin", 403, "Solo amministratori");
        pruneActivity();
        return success(
          db()
            .prepare(
              "SELECT a.id,a.action,a.resource,a.created_at,u.username FROM activity a LEFT JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 100",
            )
            .all(),
        );
      }
      if (route === "usage" && method === "GET")
        return success({
          total: storageUsage(),
          personal: storageUsage(user.id),
          quotaGb:
            workspaceSettings().storageQuotaGb ?? settingsEnvironment().quotaGb,
          userQuotaGb: workspaceSettings().userQuotaGb,
        });
      if (path[0] === "tokens") {
        if (method === "GET" && !path[1]) return success(tokensFor(user.id));

        if (method === "POST" && !path[1])
          return success(createToken(await jsonBody(request), user), 201);
        if (method === "DELETE" && path[1]) {
          deleteToken(path[1], user.id);
          return success();
        }
      }
      if (path[0] === "todo" && path[1] === "projects") {
        const id = path[2];
        if (!id && method === "GET") return success(projectsFor(user.id));
        if (!id && method === "POST") {
          const project = saveProject(await jsonBody(request), user.id);
          recordActivity(user.id, "project.create", project._id);
          return success(project, 201);
        }
        insist(id, 404, "Progetto non trovato");
        if (method === "GET") return success(getProject(id, user.id));
        if (method === "PATCH") {
          const project = saveProject(await jsonBody(request), user.id, id);
          recordActivity(user.id, "project.update", id);
          return success(project);
        }
        if (method === "DELETE") {
          deleteProject(id, user.id);
          recordActivity(user.id, "project.delete", id);
          return success();
        }
      }
      if (route === "users" && method === "GET") {
        const lookup = q.get("q")?.trim();
        if (lookup) {
          rateLimit(`user-lookup:${user.id}`, 40, 60_000);
          insist(
            lookup.length >= 3 && lookup.length <= 254,
            400,
            "Cerca username o email completi",
          );
          const match = byLogin(lookup);
          return success(match ? [publicUser(match)] : []);
        }
        if (q.get("listId")) {
          const list = getList(q.get("listId")!, user.id);
          return success(
            listMemberIds(list)
              .map(byId)
              .filter(Boolean)
              .map((u) => publicUser(u!)),
          );
        }
        if (q.get("projectId")) {
          const project = getProject(q.get("projectId")!, user.id);
          return success(
            [project.createdBy, ...project.members]
              .map(byId)
              .filter(Boolean)
              .map((u) => publicUser(u!)),
          );
        }
        return success([publicUser(user)]);
      }
      if (route === "upload" && method === "POST") {
        const files = await uploadFiles(request, user.id);
        recordActivity(user.id, "upload", String(files.length));
        return Response.json(
          { success: true, url: files[0].url, files },
          { status: 201 },
        );
      }
      if (route === "todo/ai-generate" && method === "POST")
        return Response.json(
          await aiGenerate(await jsonBody(request), user.id),
        );
      if (path[0] === "todo" && path[1] === "lists") {
        const id = path[2],
          action = path[3];
        if (!id && method === "GET")
          return success(
            listsFor(
              user.id,
              q.has("projectId")
                ? q.get("projectId") === "none"
                  ? null
                  : q.get("projectId")
                : undefined,
            ),
          );
        if (!id && method === "POST")
          return success(saveList(await jsonBody(request), user.id), 201);
        insist(id, 404, "Endpoint non trovato");
        if (action === "caddy" && method === "GET")
          return success({
            content: caddySnippet(
              getList(id, user.id, true),
              q.get("target") || "standalone",
            ),
          });
        if (!action && method === "GET") return success(getList(id, user.id));
        getList(id, user.id, true);
        if (action === "shares") {
          if (method === "GET") return success(sharesFor(id, user.id));
          if (method === "POST")
            return success(
              createShare(id, user.id, await jsonBody(request)),
              201,
            );
          if (method === "DELETE" && path[4]) {
            deleteShare(id, path[4], user.id);
            return success();
          }
        }
        if (action === "clear" && method === "DELETE") {
          const active = rawTasks(id).filter((t) => !t.isCompleted);
          transaction(() =>
            active.forEach((t) =>
              db().prepare("DELETE FROM tasks WHERE id=?").run(t._id),
            ),
          );
          return success({ deleted: active.length });
        }
        if (!action && method === "PATCH")
          return success(saveList(await jsonBody(request), user.id, id));
        if (!action && method === "DELETE") {
          db().prepare("DELETE FROM lists WHERE id=?").run(id);
          return success();
        }
      }
      if (path[0] === "todo" && path[1] === "tasks") {
        const id = path[2],
          action = path[3];
        if (id === "reorder" && method === "POST") {
          reorderTasks(await jsonBody(request), user.id);
          return success();
        }
        if (!id && method === "GET")
          return success(tasksFor(q.get("listId") || "", user.id, q));
        if (!id && method === "POST")
          return success(saveTask(await jsonBody(request), user.id), 201);
        insist(id, 404, "Endpoint non trovato");
        const task = getTask(id, user.id);
        if (action === "ai-refactor" && method === "POST")
          return success(
            await aiRefactor(task, await jsonBody(request), user.id),
          );
        if (
          action &&
          ["complete", "reopen", "favorite"].includes(action) &&
          method === "PATCH"
        )
          return success(setTaskState(id, user.id, action));
        if (action === "attachments") {
          if (method === "POST")
            return success(
              attachmentUpdate(id, user.id, await jsonBody(request)),
            );
          if (method === "DELETE") {
            insist(q.get("url"), 400, "URL richiesto");
            return success(
              attachmentUpdate(id, user.id, undefined, q.get("url")!),
            );
          }
        }
        if (!action && method === "GET") {
          const { enrichTask } = await import("@/lib/server/todo");
          return success(enrichTask(task));
        }
        if (!action && method === "PATCH")
          return success(saveTask(await jsonBody(request), user.id, id));
        if (!action && method === "DELETE") {
          db().prepare("DELETE FROM tasks WHERE id=?").run(id);
          return success();
        }
      }
      if (path[0] === "todo" && path[1] === "tags") {
        const id = path[2];
        if (!id && method === "GET")
          return success(tagsFor(q.get("listId") || "", user.id));
        if (!id && method === "POST")
          return success(saveTag(await jsonBody(request), user.id), 201);
        if (id && method === "PATCH")
          return success(saveTag(await jsonBody(request), user.id, id));
        if (id && method === "DELETE") {
          deleteTag(id, user.id);
          return success();
        }
      }
      insist(false, 404, "Endpoint non trovato");
    });
  });
  if (actorId && response.ok && request.method !== "GET")
    recordActivity(actorId, request.method, new URL(request.url).pathname);
  return response;
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
