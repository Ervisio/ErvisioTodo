import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { getList, rawTasks, tagsFor, listAccess } from "./todo";
import { digest, insist } from "./security";
import { workspaceSettings, recordActivity } from "./settings";
import { byId } from "./users";
export function sharesFor(listId: string, userId: string) {
  getList(listId, userId, true);
  return db()
    .prepare(
      "SELECT id,expires,created_at FROM public_shares WHERE list_id=? ORDER BY created_at DESC",
    )
    .all(listId);
}
export function createShare(listId: string, userId: string, input: unknown) {
  getList(listId, userId, true);
  const settings = workspaceSettings();
  insist(settings.sharingEnabled, 403, "Link pubblici disabilitati");
  const data = z
    .object({
      lifetimeHours: z.number().finite().nonnegative().max(87600).default(24),
    })
    .strict()
    .parse(input);
  const cap = settings.maxShareLifetimeHours,
    hours =
      cap > 0
        ? data.lifetimeHours > 0
          ? Math.min(data.lifetimeHours, cap)
          : cap
        : data.lifetimeHours;
  const token = randomBytes(32).toString("base64url"),
    id = randomUUID(),
    expires = hours > 0 ? Date.now() + hours * 3600000 : null;
  db()
    .prepare(
      "INSERT INTO public_shares(id,list_id,owner,hash,expires,created_at) VALUES(?,?,?,?,?,?)",
    )
    .run(id, listId, userId, digest(token), expires, Date.now());
  recordActivity(userId, "share.create", listId);
  return { id, token, expires, path: `/s/${token}` };
}
export function deleteShare(listId: string, id: string, userId: string) {
  getList(listId, userId, true);
  insist(
    db()
      .prepare("SELECT 1 FROM public_shares WHERE id=? AND list_id=?")
      .get(id, listId),
    404,
    "Link non trovato",
  );
  db().prepare("DELETE FROM public_shares WHERE id=?").run(id);
  recordActivity(userId, "share.revoke", listId);
}
export function sharedList(token: string) {
  const settings = workspaceSettings();
  insist(
    settings.sharingEnabled && /^[A-Za-z0-9_-]{43}$/.test(token),
    404,
    "Link non disponibile",
  );
  const row = db()
    .prepare("SELECT * FROM public_shares WHERE hash=?")
    .get(digest(token)) as
    | {
        list_id: string;
        owner: string;
        expires: number | null;
        created_at: number;
      }
    | undefined;
  insist(
    row &&
      (!row.expires || row.expires > Date.now()) &&
      (settings.maxShareLifetimeHours === 0 ||
        row.created_at + settings.maxShareLifetimeHours * 3600000 > Date.now()),
    404,
    "Link scaduto o non disponibile",
  );
  const user = byId(row.owner);
  insist(user?.is_active, 404, "Link non disponibile");
  const list = getList(row.list_id, user.id, true);
  const tasks = rawTasks(list._id)
    .sort((a, b) => a.order - b.order)
    .map(
      ({
        _id,
        parentTaskId,
        title,
        description,
        dueDate,
        isCompleted,
        tags,
        order,
      }) => ({
        _id,
        parentTaskId,
        title,
        description,
        dueDate,
        isCompleted,
        tags,
        order,
      }),
    );
  return {
    list: {
      title: list.title,
      iconType: list.iconType,
      iconValue: list.iconValue,
      accentColor: list.accentColor,
      backgroundColor: list.backgroundColor,
    },
    tasks,
    tags: tagsFor(list._id, user.id).map(({ _id, name, color }) => ({
      _id,
      name,
      color,
    })),
  };
}
