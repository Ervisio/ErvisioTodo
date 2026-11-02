import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "./db";
import type { Actor } from "./tokens";
export const actorContext = new AsyncLocalStorage<Actor>();
export { API_SCOPES as apiScopes } from "../api-catalog";
import { matchOperation } from "../api-catalog";
export function scopeAllows(grants: string[], scope: string) {
  return (
    grants.includes(scope) ||
    grants.includes(scope.endsWith(":write") ? "write" : "read")
  );
}
export function operationScope(path: string, method: string) {
  if (path.startsWith("/api/v1/")) {
    const matched = matchOperation(
      path.slice("/api/v1".length),
      method,
    ).operation;
    if (matched) return matched.scope;
  }

  const parts = path
    .replace(/^\/api\/(?:(?:v1|admin)\/)?/, "")
    .split("/")
    .filter(Boolean);
  if (parts[0] === "todo") parts.shift();
  const write = !["GET", "HEAD"].includes(method);
  let family = parts[0];
  if (family === "upload" || family === "uploads") family = "files";
  if (family === "usage") family = "files";
  if (family === "me" || family === "auth") family = "account";
  if (parts.includes("shares")) family = "shares";
  if (parts.includes("tags")) family = "tags";
  if (parts.includes("tasks")) family = "tasks";
  if (parts.includes("members"))
    family = parts[0] === "projects" ? "projects" : "lists";
  if (
    ![
      "projects",
      "lists",
      "tasks",
      "tags",
      "files",
      "shares",
      "settings",
      "users",
      "tokens",
      "account",
      "activity",
    ].includes(family)
  )
    family = "account";
  return `${family}:${write ? "write" : "read"}`;
}
export function tokenAllowsProject(id: string) {
  const actor = actorContext.getStore();
  return (
    !actor?.tokenId ||
    !actor.resourceRules ||
    actor.resourceRules.every(
      (rule) => rule.resourceMode === "all" || rule.projectIds.includes(id),
    )
  );
}
export function tokenAllowsList(list: {
  _id: string;
  projectId?: string | null;
}) {
  const actor = actorContext.getStore();
  return (
    !actor?.tokenId ||
    !actor.resourceRules ||
    actor.resourceRules.every(
      (rule) =>
        rule.resourceMode === "all" ||
        rule.listIds.includes(list._id) ||
        (!!list.projectId && rule.projectIds.includes(list.projectId)),
    )
  );
}
export function tokenAllowsUpload(listId: string | null) {
  const actor = actorContext.getStore();
  if (!actor?.tokenId) return true;
  if (!listId)
    return (
      actor.resourceRules?.every((rule) => rule.resourceMode === "all") ?? true
    );
  const row = db().prepare("SELECT data FROM lists WHERE id=?").get(listId) as
    { data: string } | undefined;
  return !!row && tokenAllowsList(JSON.parse(row.data));
}
