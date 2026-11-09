import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { baseDomain, canonicalUrl } from "./config";
import { insist, HttpError } from "./security";
import { byId, publicUser } from "./users";
import {
  findProject,
  projectAccess,
  getProject,
  projectMemberIds,
} from "./projects";
import { tokenAllowsList } from "./api-policy";
import { workspaceSettings } from "./settings";
import type {
  TodoListPlain,
  TodoTaskPlain,
  TodoTagPlain,
  TodoAttachment,
} from "@/types/todo";

type Row = {
  id: string;
  data: string;
  owner?: string;
  list_id?: string;
  parent_id?: string | null;
};
const stamp = () => new Date().toISOString();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colore non valido");
const assetUrl = z
  .string()
  .max(2048)
  .refine(
    (s) =>
      !s ||
      /^\/api\/files\/[a-f0-9-]+$/.test(s) ||
      /^https:\/\/[^\s]+$/i.test(s),
    "Usa una immagine caricata o un URL HTTPS",
  );
const ids = z
  .array(z.string().min(1).max(100))
  .max(100)
  .transform((a) => [...new Set(a)]);
export const listSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: z.string().nullable().default(null),
  iconType: z.enum(["fontawesome", "emoji", "image"]).default("fontawesome"),
  iconValue: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .default("fa-solid fa-list-check"),
  members: ids.default([]),
  aiContext: z.string().max(8000).default(""),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(63)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usa lettere minuscole, numeri e trattini",
    ),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(63)
    .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Sottodominio non valido")
    .default(""),
  accentColor: color.default("#b94406"),
  backgroundColor: z.union([z.literal(""), color]).default(""),
  faviconUrl: assetUrl.default(""),
});
const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  url: assetUrl,
  mimeType: z.string().max(150),
});
const taskFields = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(2_000_000).default(""),
  assignedTo: ids.default([]),
  dueDate: z
    .string()
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v)), "Data non valida")
    .nullable()
    .default(null),
  isFavorite: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(1000).default([]),
  tags: ids.default([]),
});
export const taskCreateSchema = taskFields.extend({
  listId: z.string().min(1),
  parentTaskId: z.string().nullable().default(null),
});
export const taskPatchSchema = z.object({
  title: taskFields.shape.title.optional(),
  description: taskFields.shape.description.removeDefault().optional(),
  assignedTo: taskFields.shape.assignedTo.removeDefault().optional(),
  dueDate: taskFields.shape.dueDate.removeDefault().optional(),
  isFavorite: taskFields.shape.isFavorite.removeDefault().optional(),
  attachments: taskFields.shape.attachments.removeDefault().optional(),
  tags: taskFields.shape.tags.removeDefault().optional(),
});
export const tagSchema = z.object({
  listId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  color,
});

export function getList(
  id: string,
  userId: string,
  ownerOnly = false,
): TodoListPlain {
  const row = db().prepare("SELECT * FROM lists WHERE id=?").get(id) as
    Row | undefined;
  insist(row, 404, "Lista non trovata");
  const list: TodoListPlain = { projectId: null, ...JSON.parse(row.data) };
  insist(
    listAccess(list, userId, ownerOnly) && tokenAllowsList(list),
    404,
    "Lista non trovata",
  );
  return list;
}
export function listAccess(
  list: TodoListPlain,
  userId: string,
  ownerOnly = false,
) {
  const project = list.projectId ? findProject(list.projectId) : undefined;
  return (
    list.createdBy === userId ||
    projectAccess(project, userId, ownerOnly) ||
    (!ownerOnly && list.members.includes(userId))
  );
}
export function listMemberIds(list: TodoListPlain) {
  return [
    ...new Set([
      list.createdBy,
      ...list.members,
      ...projectMemberIds(list.projectId),
    ]),
  ];
}
export function listsFor(userId: string, projectId?: string | null) {
  const open = new Map(
    (
      db()
        .prepare(
          "SELECT list_id, count(*) AS n FROM tasks WHERE parent_id IS NULL AND json_extract(data,'$.isCompleted')=0 GROUP BY list_id",
        )
        .all() as { list_id: string; n: number }[]
    ).map((r) => [r.list_id, r.n]),
  );
  return (db().prepare("SELECT data FROM lists ORDER BY rowid").all() as Row[])
    .map((r) => ({ projectId: null, ...JSON.parse(r.data) }) as TodoListPlain)
    .filter(
      (l) =>
        listAccess(l, userId) &&
        tokenAllowsList(l) &&
        (projectId === undefined || l.projectId === projectId),
    )
    .map((l) => ({ ...l, openTaskCount: open.get(l._id) ?? 0 }));
}
export function listBySlug(slug: string, userId: string) {
  const row = db().prepare("SELECT id FROM lists WHERE slug=?").get(slug) as
    { id: string } | undefined;
  return row ? getList(row.id, userId) : null;
}
export function brandingFor(host: string, slug?: string) {
  let row: Row | undefined;
  if (slug)
    row = db().prepare("SELECT data FROM lists WHERE slug=?").get(slug) as
      Row | undefined;
  else {
    const base = baseDomain(),
      hostname = host.split(":")[0].toLowerCase();
    if (base && hostname.endsWith("." + base))
      row = db()
        .prepare("SELECT data FROM lists WHERE subdomain=?")
        .get(hostname.slice(0, -(base.length + 1))) as Row | undefined;
  }
  if (!row) return null;
  const l: TodoListPlain = JSON.parse(row.data);
  return {
    _id: l._id,
    title: l.title,
    iconType: l.iconType,
    iconValue: l.iconValue,
    slug: l.slug,
    faviconUrl: l.faviconUrl,
    accentColor: l.accentColor,
    backgroundColor: l.backgroundColor,
  };
}
function validateList(
  data: z.infer<typeof listSchema>,
  userId: string,
  previous?: TodoListPlain,
) {
  if (data.projectId && data.projectId !== previous?.projectId)
    getProject(data.projectId, userId);
  insist(
    data.members.every((id) => !!byId(id)),
    400,
    "Uno o più membri non esistono",
  );
  if (data.iconType === "image") assetUrl.parse(data.iconValue);
  if (data.iconType === "fontawesome")
    insist(
      /^fa-(solid|regular|brands) fa-[a-z0-9-]+$/.test(data.iconValue),
      400,
      "Classe icona non valida",
    );
  if (data.iconType === "emoji")
    insist(data.iconValue.length <= 32, 400, "Emoji troppo lunga");
  if (data.subdomain) {
    insist(
      baseDomain(),
      400,
      "Il gestore deve configurare BASE_DOMAIN per usare i sottodomini",
    );
    const reserved = [
      "www",
      "api",
      "auth",
      "admin",
      "mail",
      "smtp",
      "ftp",
      "localhost",
      "caddy",
    ];
    insist(
      !reserved.includes(data.subdomain) &&
        `${data.subdomain}.${baseDomain()}` !==
          new URL(canonicalUrl()).hostname,
      400,
      "Sottodominio riservato",
    );
  }
  for (const url of [
    data.faviconUrl,
    data.iconType === "image" ? data.iconValue : "",
  ])
    if (url.startsWith("/api/files/")) {
      const upload = db()
        .prepare("SELECT owner FROM uploads WHERE id=?")
        .get(url.split("/").pop()!) as { owner: string } | undefined;
      insist(
        upload &&
          (upload.owner === userId ||
            (!!previous &&
              (url === previous.faviconUrl || url === previous.iconValue))),
        400,
        "Puoi usare come branding solo immagini caricate da te",
      );
      const image = db()
        .prepare("SELECT mime FROM uploads WHERE id=?")
        .get(url.split("/").pop()!) as { mime: string };
      insist(
        image.mime.startsWith("image/"),
        400,
        "Il branding richiede una immagine",
      );
    }
}
export function saveList(input: unknown, userId: string, id?: string) {
  const previous = id ? getList(id, userId, true) : undefined;
  const data = listSchema.parse(
    previous ? { ...previous, ...(input as object) } : input,
  );
  validateList(data, userId, previous);
  const key = id || randomUUID();
  const value: TodoListPlain = {
    ...data,
    members: data.members.filter((x) => x !== (previous?.createdBy || userId)),
    _id: key,
    createdBy: previous?.createdBy || userId,
    order: previous?.order || 0,
    createdAt: previous?.createdAt || stamp(),
    updatedAt: stamp(),
  };
  insist(
    tokenAllowsList(value),
    403,
    "Il token non consente questa lista o progetto",
  );
  try {
    transaction(() => {
      db()
        .prepare(
          "INSERT INTO lists(id,owner,slug,subdomain,data,project_id) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,subdomain=excluded.subdomain,data=excluded.data,project_id=excluded.project_id",
        )
        .run(
          key,
          value.createdBy,
          data.slug,
          data.subdomain || null,
          JSON.stringify(value),
          data.projectId,
        );
      // A removed member must no longer remain assigned to a task.
      const allowed = new Set(listMemberIds(value));
      for (const task of rawTasks(key))
        if (task.assignedTo.some((u) => !allowed.has(u)))
          writeTask({
            ...task,
            assignedTo: task.assignedTo.filter((u) => allowed.has(u)),
            updatedAt: stamp(),
          });
    });
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      throw new HttpError(409, "URL o sottodominio già utilizzato");
    throw e;
  }
  return value;
}
export function rawTasks(listId: string): TodoTaskPlain[] {
  return (
    db()
      .prepare("SELECT data FROM tasks WHERE list_id=? ORDER BY rowid")
      .all(listId) as Row[]
  ).map((r) => JSON.parse(r.data));
}
export function getTask(id: string, userId: string) {
  const row = db().prepare("SELECT data FROM tasks WHERE id=?").get(id) as
    Row | undefined;
  insist(row, 404, "Attività non trovata");
  const task: TodoTaskPlain = JSON.parse(row.data);
  getList(task.listId, userId);
  return task;
}
type ChildCounts = Map<string, { total: number; done: number }>;
function childCounts(listId: string, parentId?: string): ChildCounts {
  const rows = db()
    .prepare(
      `SELECT parent_id, count(*) AS total, sum(json_extract(data,'$.isCompleted')) AS done FROM tasks WHERE list_id=?${parentId ? " AND parent_id=?" : " AND parent_id IS NOT NULL"} GROUP BY parent_id`,
    )
    .all(...(parentId ? [listId, parentId] : [listId])) as {
    parent_id: string;
    total: number;
    done: number;
  }[];
  return new Map(rows.map((r) => [r.parent_id, r]));
}
export function enrichTask(
  task: TodoTaskPlain,
  counts = childCounts(task.listId, task._id),
) {
  const user = (id: string | null) => {
    const u = id ? byId(id) : undefined;
    return u ? publicUser(u) : undefined;
  };
  const children = counts.get(task._id) ?? { total: 0, done: 0 };
  return {
    ...task,
    childCount: children.total - children.done,
    subtaskCount: children.total,
    subtaskDoneCount: children.done,
    assignedToUsers: task.assignedTo.map(user).filter(Boolean),
    completedByUser: user(task.completedBy),
    createdByUser: user(task.createdBy),
  };
}
export function tasksFor(
  listId: string,
  userId: string,
  query: URLSearchParams,
) {
  getList(listId, userId);
  const tags = (query.get("tags") || "").split(",").filter(Boolean);
  const all = rawTasks(listId),
    queryText = (query.get("q") || "").trim().toLocaleLowerCase();
  let matched: Set<string> | null = null;
  if (queryText) {
    matched = new Set();
    for (const item of all)
      if (
        (item.title + " " + item.description)
          .toLocaleLowerCase()
          .includes(queryText)
      ) {
        let current: TodoTaskPlain | undefined = item;
        const seen = new Set<string>();
        while (current && !seen.has(current._id)) {
          seen.add(current._id);
          matched.add(current._id);
          current = all.find((t) => t._id === current!.parentTaskId);
        }
      }
  }
  const counts = childCounts(listId);
  return all
    .filter((t) => {
      if (matched && !matched.has(t._id)) return false;
      if (query.get("completed") === "true") {
        if (!t.isCompleted) return false;
      } else if (t.isCompleted) return false;
      if (query.get("favorites") === "true" && !t.isFavorite) return false;
      const parent = query.get("parentTaskId");
      if (
        parent !== null &&
        t.parentTaskId !== (parent === "null" ? null : parent)
      )
        return false;
      return tags.every((tag) => t.tags.includes(tag));
    })
    .sort((a, b) => a.order - b.order)
    .map((t) => enrichTask(t, counts));
}
export type SmartView = "today" | "important";
/** Open tasks across every list the user can see: due in [from, to) for "today", starred for "important". */
export function smartTasks(
  userId: string,
  view: SmartView,
  from?: string | null,
  to?: string | null,
) {
  const start = Date.parse(from || ""),
    end = Date.parse(to || "");
  insist(
    view !== "today" || (start < end && end - start <= 2 * 86_400_000),
    400,
    "Intervallo non valido",
  );
  return listsFor(userId).flatMap((list) => {
    const counts = childCounts(list._id);
    return rawTasks(list._id)
      .filter((t) => {
        if (t.isCompleted) return false;
        if (view === "important") return t.isFavorite;
        const due = t.dueDate ? Date.parse(String(t.dueDate)) : NaN;
        return due >= start && due < end;
      })
      .sort((a, b) => a.order - b.order)
      .map((t) => enrichTask(t, counts));
  });
}
export function smartCounts(
  userId: string,
  from?: string | null,
  to?: string | null,
) {
  return {
    today: from && to ? smartTasks(userId, "today", from, to).length : 0,
    important: smartTasks(userId, "important").length,
  };
}
function checkTaskReferences(
  data: z.infer<typeof taskFields>,
  list: TodoListPlain,
  userId: string,
) {
  const limits = workspaceSettings();
  insist(
    limits.maxAttachmentsPerTask === 0 ||
      data.attachments.length <= limits.maxAttachmentsPerTask,
    400,
    "Troppi allegati per questa attività",
  );
  insist(
    limits.editorMaxMb === 0 ||
      Buffer.byteLength(data.description, "utf8") <=
        limits.editorMaxMb * 1024 ** 2,
    400,
    "La descrizione supera il limite configurato",
  );
  const members = new Set(listMemberIds(list));
  insist(
    data.assignedTo.every((id) => members.has(id)),
    400,
    "Assegna solo a membri della lista",
  );
  insist(
    data.tags.every(
      (id) =>
        !!db()
          .prepare("SELECT 1 FROM tags WHERE id=? AND list_id=?")
          .get(id, list._id),
    ),
    400,
    "Tag di un’altra lista o inesistenti",
  );
  for (const att of data.attachments)
    if (att.url.startsWith("/api/files/")) {
      const up = db()
        .prepare("SELECT owner,list_id FROM uploads WHERE id=?")
        .get(att.url.split("/").pop()!) as
        { owner: string; list_id: string | null } | undefined;
      insist(
        up &&
          (up.owner === userId || up.list_id === list._id) &&
          (!up.list_id || up.list_id === list._id),
        400,
        "Allegato non accessibile in questa lista",
      );
    }
}
export function writeTask(task: TodoTaskPlain) {
  db()
    .prepare(
      "INSERT INTO tasks(id,list_id,parent_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET list_id=excluded.list_id,parent_id=excluded.parent_id,data=excluded.data",
    )
    .run(task._id, task.listId, task.parentTaskId, JSON.stringify(task));
}
export function saveTask(input: unknown, userId: string, id?: string) {
  const previous = id ? getTask(id, userId) : undefined;
  const parsed = previous
    ? { ...previous, ...taskPatchSchema.parse(input) }
    : taskCreateSchema.parse(input);
  const data = taskFields.parse(parsed),
    list = getList(parsed.listId, userId);
  checkTaskReferences(data, list, userId);
  if (parsed.parentTaskId) {
    const parent = getTask(parsed.parentTaskId, userId);
    insist(
      parent.listId === list._id && !parent.isCompleted,
      400,
      "L’attività padre deve essere attiva nella stessa lista",
    );
  }
  const siblings = rawTasks(list._id).filter(
    (t) => t.parentTaskId === parsed.parentTaskId,
  );
  const value: TodoTaskPlain = {
    ...data,
    _id: id || randomUUID(),
    listId: list._id,
    parentTaskId: parsed.parentTaskId,
    isCompleted: previous?.isCompleted || false,
    completedAt: previous?.completedAt || null,
    completedBy: previous?.completedBy || null,
    order: previous?.order ?? Math.max(-1, ...siblings.map((t) => t.order)) + 1,
    createdBy: previous?.createdBy || userId,
    createdAt: previous?.createdAt || stamp(),
    updatedAt: stamp(),
  };
  transaction(() => {
    writeTask(value);
    for (const att of data.attachments)
      if (att.url.startsWith("/api/files/"))
        db()
          .prepare(
            "UPDATE uploads SET list_id=? WHERE id=? AND list_id IS NULL",
          )
          .run(list._id, att.url.split("/").pop()!);
  });
  return enrichTask(value);
}
export function setTaskState(id: string, userId: string, action: string) {
  const task = getTask(id, userId),
    all = rawTasks(task.listId);
  return transaction(() => {
    if (action === "favorite") {
      task.isFavorite = !task.isFavorite;
      task.updatedAt = stamp();
      writeTask(task);
    } else if (action === "complete") {
      const affected = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const t of all)
          if (
            t.parentTaskId &&
            affected.has(t.parentTaskId) &&
            !affected.has(t._id)
          ) {
            affected.add(t._id);
            changed = true;
          }
      }
      for (const t of all)
        if (affected.has(t._id) && !t.isCompleted)
          writeTask({
            ...t,
            isCompleted: true,
            completedAt: stamp(),
            completedBy: userId,
            updatedAt: stamp(),
          });
    } else if (action === "reopen") {
      let current: TodoTaskPlain | undefined = task;
      const seen = new Set<string>();
      while (current && !seen.has(current._id)) {
        seen.add(current._id);
        writeTask({
          ...current,
          isCompleted: false,
          completedAt: null,
          completedBy: null,
          updatedAt: stamp(),
        });
        current = all.find((t) => t._id === current!.parentTaskId);
      }
    }
    return getTask(id, userId);
  });
}
export function reorderTasks(input: unknown, userId: string) {
  const { ids: ordered } = z
    .object({
      ids: z
        .array(z.string())
        .min(1)
        .max(1000)
        .refine((a) => new Set(a).size === a.length, "ID duplicati"),
    })
    .parse(input);
  const tasks = ordered.map((id) => getTask(id, userId));
  insist(
    tasks.every((t) => t.listId === tasks[0].listId),
    400,
    "Riordina attività della stessa lista",
  );
  transaction(() =>
    tasks.forEach((t, i) => writeTask({ ...t, order: i, updatedAt: stamp() })),
  );
}
export function tagsFor(listId: string, userId: string): TodoTagPlain[] {
  getList(listId, userId);
  return (
    db()
      .prepare("SELECT data FROM tags WHERE list_id=? ORDER BY name")
      .all(listId) as Row[]
  ).map((r) => JSON.parse(r.data));
}
export function getTag(id: string, userId: string): TodoTagPlain {
  const row = db().prepare("SELECT data FROM tags WHERE id=?").get(id) as
    Row | undefined;
  insist(row, 404, "Tag non trovato");
  const tag = JSON.parse(row.data) as TodoTagPlain;
  getList(tag.listId, userId);
  return tag;
}
export function saveTag(input: unknown, userId: string, id?: string) {
  const previous = id ? getTag(id, userId) : undefined;
  const data = tagSchema.parse(
    previous
      ? {
          ...previous,
          ...z
            .object({
              name: tagSchema.shape.name.optional(),
              color: color.optional(),
            })
            .parse(input),
        }
      : input,
  );
  getList(data.listId, userId);
  const value: TodoTagPlain = {
    ...data,
    _id: id || randomUUID(),
    createdBy: previous?.createdBy || userId,
    createdAt: previous?.createdAt || stamp(),
    updatedAt: stamp(),
  };
  try {
    db()
      .prepare(
        "INSERT INTO tags(id,list_id,name,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data",
      )
      .run(value._id, data.listId, data.name, JSON.stringify(value));
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      throw new HttpError(409, "Tag già presente");
    throw e;
  }
  return value;
}
export function deleteTag(id: string, userId: string) {
  const tag = getTag(id, userId);
  transaction(() => {
    db().prepare("DELETE FROM tags WHERE id=?").run(id);
    for (const task of rawTasks(tag.listId))
      if (task.tags.includes(id))
        writeTask({
          ...task,
          tags: task.tags.filter((t) => t !== id),
          updatedAt: stamp(),
        });
  });
}
export function attachmentUpdate(
  id: string,
  userId: string,
  input?: unknown,
  removeUrl?: string,
) {
  const task = getTask(id, userId);
  const attachments = removeUrl
    ? task.attachments.filter((a) => a.url !== removeUrl)
    : [...task.attachments, attachmentSchema.parse(input)];
  return saveTask({ attachments }, userId, id);
}
export function caddySnippet(list: TodoListPlain, target: string) {
  insist(
    list.subdomain && baseDomain(),
    400,
    "Seleziona prima un sottodominio",
  );
  const upstream = target === "docker" ? "app:3000" : "127.0.0.1:3000";
  return `${list.subdomain}.${baseDomain()} {\n\tencode zstd gzip\n\treverse_proxy ${upstream} {\n\t\theader_up X-Real-IP {remote_host}\n\t}\n}\n`;
}
