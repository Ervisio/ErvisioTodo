import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { byId, type DbUser } from "./users";
import { digest, insist, rateLimit } from "./security";
import { workspaceSettings, recordActivity } from "./settings";
import {
  apiScopes,
  operationScope,
  scopeAllows,
  actorContext,
} from "./api-policy";
import { getList } from "./todo";
import { getProject } from "./projects";
export type ResourceRule = {
  resourceMode: "all" | "selected";
  projectIds: string[];
  listIds: string[];
};
export type Actor = DbUser & {
  tokenId?: string;
  tokenScopes?: string[];
  tokenExpires?: number;
  resourceRules?: ResourceRule[];
};
type TokenRow = {
  id: string;
  owner: string;
  name: string;
  scopes: string;
  expires: number;
  created_at: number;
  last_used: number | null;
  parent_id: string | null;
  resource_mode: "all" | "selected";
  project_ids: string;
  list_ids: string;
};
const rule = (row: TokenRow): ResourceRule => ({
  resourceMode: row.resource_mode,
  projectIds: JSON.parse(row.project_ids),
  listIds: JSON.parse(row.list_ids),
});
export function actorFromToken(request: Request): Actor | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization) return;
  insist(
    /^Bearer evt_[A-Za-z0-9_-]{43}$/.test(authorization),
    401,
    "Token API non valido",
  );
  const settings = workspaceSettings();
  insist(settings.apiEnabled, 403, "Accesso API disabilitato");
  const row = db()
    .prepare("SELECT * FROM api_tokens WHERE hash=?")
    .get(digest(authorization.slice(7))) as TokenRow | undefined;
  insist(row && row.expires > Date.now(), 401, "Token API scaduto o revocato");
  const user = byId(row.owner);
  insist(user?.is_active, 401, "Account non disponibile");
  insist(
    user.role === "admin" || settings.membersCanCreateTokens,
    403,
    "Accesso API dei membri disabilitato",
  );
  const chain: TokenRow[] = [row];
  let parent = row.parent_id;
  while (parent) {
    insist(chain.length < 16, 401, "Catena token non valida");
    const found = db()
      .prepare("SELECT * FROM api_tokens WHERE id=?")
      .get(parent) as TokenRow | undefined;
    insist(
      found && found.owner === user.id && found.expires > Date.now(),
      401,
      "Token padre scaduto o revocato",
    );
    chain.push(found);
    parent = found.parent_id;
  }
  const required = operationScope(
    new URL(request.url).pathname,
    request.method,
  );
  insist(
    !required ||
      chain.every((item) => scopeAllows(JSON.parse(item.scopes), required)),
    403,
    "Il token non consente questa operazione",
  );
  if (settings.apiRequestsPerMinute > 0)
    rateLimit(`api:${row.id}`, settings.apiRequestsPerMinute, 60_000);
  db()
    .prepare("UPDATE api_tokens SET last_used=? WHERE id=?")
    .run(Date.now(), row.id);
  return {
    ...user,
    tokenId: row.id,
    tokenScopes: JSON.parse(row.scopes),
    tokenExpires: Math.min(...chain.map((item) => item.expires)),
    resourceRules: chain.map(rule),
  };
}
function visibleToken(row: TokenRow) {
  return {
    id: row.id,
    name: row.name,
    scopes: JSON.parse(row.scopes),
    expires: row.expires,
    created_at: row.created_at,
    last_used: row.last_used,
    parentId: row.parent_id,
    ...rule(row),
  };
}
export function tokensFor(userId: string) {
  return (
    db()
      .prepare(
        "SELECT * FROM api_tokens WHERE owner=? ORDER BY created_at DESC",
      )
      .all(userId) as TokenRow[]
  ).map(visibleToken);
}
export function getToken(id: string, userId: string) {
  const row = db()
    .prepare("SELECT * FROM api_tokens WHERE id=? AND owner=?")
    .get(id, userId) as TokenRow | undefined;
  insist(row, 404, "Token non trovato");
  return visibleToken(row);
}
export const tokenSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z
      .array(z.enum(apiScopes))
      .min(1)
      .transform((a) => [...new Set(a)])
      .default(["read"]),
    lifetimeDays: z.number().int().min(1).optional(),
    resourceMode: z.enum(["all", "selected"]).default("all"),
    projectIds: z.array(z.string()).max(100).default([]),
    listIds: z.array(z.string()).max(100).default([]),
  })
  .strict();
export function createToken(input: unknown, user: Actor) {
  const settings = workspaceSettings();
  insist(settings.apiEnabled, 403, "Accesso API disabilitato");
  insist(
    user.role === "admin" || settings.membersCanCreateTokens,
    403,
    "Creazione token non consentita",
  );
  const data = tokenSchema.parse(input),
    days = data.lifetimeDays ?? settings.defaultTokenLifetimeDays;
  insist(
    days <= settings.maxTokenLifetimeDays,
    400,
    "La durata supera il massimo configurato",
  );
  insist(
    data.resourceMode === "all" ||
      data.projectIds.length + data.listIds.length > 0,
    400,
    "Seleziona almeno un progetto o una lista",
  );
  for (const id of data.projectIds) getProject(id, user.id);
  for (const id of data.listIds) getList(id, user.id);
  if (user.tokenId)
    for (const scope of data.scopes)
      insist(
        scope === "read" || scope === "write"
          ? user.tokenScopes?.includes(scope)
          : scopeAllows(user.tokenScopes || [], scope),
        403,
        "Il nuovo token non può ampliare gli ambiti del padre",
      );
  const token = `evt_${randomBytes(32).toString("base64url")}`,
    id = randomUUID(),
    expires = Math.min(
      Date.now() + days * 86400000,
      user.tokenExpires ?? Infinity,
    );
  db()
    .prepare(
      "INSERT INTO api_tokens(id,owner,name,hash,scopes,expires,created_at,parent_id,resource_mode,project_ids,list_ids) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      user.id,
      data.name,
      digest(token),
      JSON.stringify(data.scopes),
      expires,
      Date.now(),
      user.tokenId || null,
      data.resourceMode,
      JSON.stringify(data.projectIds),
      JSON.stringify(data.listIds),
    );
  recordActivity(user.id, "token.create", id);
  return {
    id,
    name: data.name,
    token,
    scopes: data.scopes,
    expires,
    resourceMode: data.resourceMode,
    projectIds: data.projectIds,
    listIds: data.listIds,
    parentId: user.tokenId || null,
  };
}
export function deleteToken(id: string, userId: string) {
  getToken(id, userId);
  db().prepare("DELETE FROM api_tokens WHERE id=?").run(id);
  recordActivity(userId, "token.revoke", id);
}
