import { z } from "zod";
import { api, requireUser, success } from "@/lib/server/http";
import {
  assertOrigin,
  jsonBody,
  insist,
  rateLimit,
  HttpError,
} from "@/lib/server/security";
import { actorContext } from "@/lib/server/api-policy";
import { matchOperation } from "@/lib/api-catalog";
import {
  availableProviders,
  authSettings,
  canonicalUrl,
  publicConfig,
} from "@/lib/server/config";
import {
  apiSignIn,
  apiAccountAction,
  changePassword,
} from "@/lib/server/api-auth";
import {
  managedUser,
  usersForAdmin,
  createManagedUser,
  changeManagedUser,
} from "@/lib/server/admin-users";
import { getToken, deleteToken, tokensFor } from "@/lib/server/tokens";
import { byId, byLogin, publicUser } from "@/lib/server/users";
import { db } from "@/lib/server/db";
import { getProject, saveProject } from "@/lib/server/projects";
import {
  getList,
  saveList,
  listsFor,
  tasksFor,
  tagsFor,
  listMemberIds,
  getTag,
  getTask,
  setTaskState,
} from "@/lib/server/todo";
import { aiGenerate } from "@/lib/server/ai";
import { transferTask } from "@/lib/server/task-transfer";
import { uploadFiles } from "@/lib/server/files";
import {
  accessibleFiles,
  fileMetadata,
  changeFile,
  downloadFile,
} from "@/lib/server/api-files";
import { recordActivity, workspaceSettings } from "@/lib/server/settings";
import { GET as adminHandler } from "../../admin/[...path]/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return api(async () => {
    const { path } = await context.params,
      url = new URL(request.url),
      method = request.method,
      route = "/" + path.join("/"),
      { operation, allowed } = matchOperation(route, method);
    if (!operation)
      return Response.json(
        {
          success: false,
          error: allowed.length
            ? "Metodo non consentito"
            : "Endpoint non trovato",
        },
        {
          status: allowed.length ? 405 : 404,
          headers: allowed.length ? { Allow: allowed.join(", ") } : undefined,
        },
      );
    const body = () => jsonBody(request);
    if (operation.public) {
      if (method === "POST") {
        insist(
          request.headers.get("content-type")?.split(";")[0] ===
            "application/json",
          415,
          "Content-Type application/json richiesto",
        );
        if (request.headers.has("origin")) assertOrigin(request);
      }
      if (path[1] === "providers")
        return success({
          providers: availableProviders(),
          registration: authSettings().registration,
          oauth: {
            google: `${canonicalUrl()}/login?provider=google`,
            discord: `${canonicalUrl()}/login?provider=discord`,
            cognito: `${canonicalUrl()}/login?provider=cognito`,
          },
          note: "OAuth usa il flusso browser sicuro Auth.js; genera poi un token dalla pagina Account.",
        });
      if (path[1] === "login")
        return success(await apiSignIn(await body(), request), 201);
      return success(
        await apiAccountAction(path[1], await body(), request),
        path[1] === "register" ? 201 : 200,
      );
    }
    const user = await requireUser(request);
    return actorContext.run(user, async () => {
      if (method !== "GET") {
        if (!user.tokenId) assertOrigin(request);
        const limit = workspaceSettings().writeRequestsPerMinute;
        if (limit > 0) rateLimit(`write-v1:${user.id}`, limit, 60_000);
      }
      let result: Response | undefined;
      const listResponse = (values: unknown[]) => {
        const rawLimit = url.searchParams.get("limit") || "100",
          rawOffset = url.searchParams.get("offset") || "0",
          limit = Number(rawLimit),
          offset = Number(rawOffset);
        insist(
          Number.isInteger(limit) &&
            limit >= 1 &&
            limit <= 500 &&
            Number.isInteger(offset) &&
            offset >= 0,
          400,
          "limit deve essere 1..500 e offset >= 0",
        );
        return Response.json(
          {
            success: true,
            data: values.slice(offset, offset + limit),
            pagination: {
              total: values.length,
              limit,
              offset,
              hasMore: offset + limit < values.length,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      };
      if (route === "/ai/generate")
        return success(await aiGenerate(await body(), user.id));
      if (route === "/me")
        return success({
          user: managedUser(user),
          token: user.tokenId
            ? {
                id: user.tokenId,
                scopes: user.tokenScopes,
                expires: user.tokenExpires,
                resourceRules: user.resourceRules,
              }
            : null,
          config: publicConfig(),
        });
      if (route === "/auth/logout") {
        if (user.tokenId) deleteToken(user.tokenId, user.id);
        else
          db()
            .prepare(
              "UPDATE users SET session_version=session_version+1 WHERE id=?",
            )
            .run(user.id);
        return success();
      }
      if (route === "/account/password")
        return success(await changePassword(await body(), user));
      if (route === "/users/lookup") {
        const q = url.searchParams.get("q")?.trim();
        insist(
          q && q.length >= 3 && q.length <= 254,
          400,
          "Cerca username o email completi",
        );
        rateLimit(`user-lookup:${user.id}`, 40, 60_000);
        const found = byLogin(q);
        return success(found?.is_active ? [publicUser(found)] : []);
      }
      if (path[0] === "users") {
        insist(user.role === "admin", 403, "Solo amministratori");
        const id = path[1];
        if (!id)
          return method === "GET"
            ? listResponse(usersForAdmin())
            : success(await createManagedUser(await body(), user), 201);
        const found = byId(id);
        insist(found, 404, "Utente non trovato");
        if (method === "GET") return success(managedUser(found));
        return success(
          changeManagedUser(
            id,
            method === "DELETE" ? { active: false } : await body(),
            user,
          ),
        );
      }
      if (route === "/tokens" && method === "GET")
        return listResponse(tokensFor(user.id));
      if (route === "/files/upload") {
        const files = await uploadFiles(request, user.id);
        recordActivity(user.id, "file.upload", String(files.length));
        return success({ files }, 201);
      }
      if (path[0] === "files") {
        if (!path[1])
          return listResponse(
            accessibleFiles(user.id, url.searchParams.get("listId")),
          );
        if (path[1] !== "upload") {
          const id = path[1];
          if (path[2] === "download") return downloadFile(id, user.id);
          if (method === "GET") return success(fileMetadata(id, user.id));
          const changed = changeFile(
            id,
            user.id,
            method === "PATCH" ? await body() : undefined,
          );
          recordActivity(
            user.id,
            method === "PATCH" ? "file.rename" : "file.delete",
            id,
          );
          return success(changed);
        }
      }
      if (path[0] === "tokens" && path[1] && method === "GET")
        return success(getToken(path[1], user.id));
      if (path[0] === "projects" && path[2] === "lists") {
        getProject(path[1], user.id);
        return listResponse(listsFor(user.id, path[1]));
      }
      if (["lists", "projects"].includes(path[0]) && path[2] === "members") {
        const project = path[0] === "projects",
          resource = project
            ? getProject(path[1], user.id, method === "PUT")
            : getList(path[1], user.id, method === "PUT");
        if (method === "PUT") {
          const data = z
            .object({ members: z.array(z.string().min(1)).max(100) })
            .strict()
            .parse(await body());
          return success(
            project
              ? saveProject(data, user.id, path[1])
              : saveList(data, user.id, path[1]),
          );
        }
        return success({
          owner: resource.createdBy,
          explicit: resource.members,
          effective: (project
            ? [resource.createdBy, ...resource.members]
            : listMemberIds(resource as ReturnType<typeof getList>)
          )
            .map(byId)
            .filter(Boolean)
            .map((u) => publicUser(u!)),
        });
      }
      if (
        path[0] === "lists" &&
        ["tasks", "tags"].includes(path[2]) &&
        method === "GET"
      )
        return listResponse(
          path[2] === "tasks"
            ? tasksFor(path[1], user.id, url.searchParams)
            : tagsFor(path[1], user.id),
        );
      if (route === "/tasks/bulk") {
        const data = z
          .object({
            ids: z.array(z.string()).min(1).max(100),
            action: z.enum(["complete", "reopen", "delete"]),
          })
          .strict()
          .parse(await body());
        const results = data.ids.map((id) => {
          try {
            getTask(id, user.id);
            if (data.action === "delete")
              db().prepare("DELETE FROM tasks WHERE id=?").run(id);
            else setTaskState(id, user.id, data.action);
            return { id, success: true };
          } catch (error) {
            return {
              id,
              success: false,
              status: error instanceof HttpError ? error.status : 500,
              error:
                error instanceof HttpError
                  ? error.message
                  : "Operazione fallita",
            };
          }
        });
        recordActivity(user.id, "task.bulk", data.action);
        return success({ results });
      }
      if (path[0] === "tasks" && ["copy", "move"].includes(path[2]))
        return success(
          transferTask(path[1], await body(), user.id, path[2] === "copy"),
          path[2] === "copy" ? 201 : 200,
        );
      if (path[0] === "tags" && path[1] && method === "GET")
        return success(getTag(path[1], user.id));
      if (
        method === "GET" &&
        path.length === 1 &&
        ["lists", "projects", "tasks", "tags"].includes(path[0])
      ) {
        // The compatibility handler returns the same service data; only v1 adds pagination.
        result = await adminHandler(request, {
          params: Promise.resolve({ path: ["todo", ...path] }),
        });
        if (result.ok) {
          const json = await result.json();
          return listResponse(json.data);
        }
        return result;
      }
      const mapped =
        path[0] === "files" && path[1] === "upload"
          ? ["upload"]
          : path[0] === "ai"
            ? ["todo", "ai-generate"]
            : ["projects", "lists", "tasks", "tags"].includes(path[0])
              ? ["todo", ...path]
              : path;
      result = await adminHandler(request, {
        params: Promise.resolve({ path: mapped }),
      });
      return result;
    });
  });
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
