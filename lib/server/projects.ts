import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { tokenAllowsProject, actorContext } from "./api-policy";
import { byId } from "./users";
import { insist, HttpError } from "./security";
import type { TodoProjectPlain, TodoListPlain } from "@/types/todo";
export const projectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(63)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usa lettere minuscole, numeri e trattini",
    ),
  description: z.string().max(4000).default(""),
  iconValue: z.string().min(1).max(64).default("fa-solid fa-folder"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#b94406"),
  members: z
    .array(z.string().min(1).max(100))
    .max(100)
    .transform((ids) => [...new Set(ids)])
    .default([]),
});
export function findProject(id: string): TodoProjectPlain | undefined {
  const row = db().prepare("SELECT data FROM projects WHERE id=?").get(id) as
    { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function projectAccess(
  project: TodoProjectPlain | undefined,
  userId: string,
  ownerOnly = false,
) {
  return (
    !!project &&
    (project.createdBy === userId ||
      (!ownerOnly && project.members.includes(userId)))
  );
}
export function getProject(id: string, userId: string, ownerOnly = false) {
  const project = findProject(id);
  insist(
    projectAccess(project, userId, ownerOnly) && tokenAllowsProject(id),
    404,
    "Progetto non trovato",
  );
  return project!;
}
export function projectBySlug(slug: string, userId: string) {
  const row = db().prepare("SELECT id FROM projects WHERE slug=?").get(slug) as
    { id: string } | undefined;
  return row ? getProject(row.id, userId) : null;
}
export function projectsFor(userId: string): TodoProjectPlain[] {
  return (
    db().prepare("SELECT data FROM projects ORDER BY rowid").all() as {
      data: string;
    }[]
  )
    .map((r) => JSON.parse(r.data) as TodoProjectPlain)
    .filter((p) => projectAccess(p, userId) && tokenAllowsProject(p._id))
    .map((p) => ({
      ...p,
      listCount: (
        db()
          .prepare("SELECT count(*) n FROM lists WHERE project_id=?")
          .get(p._id) as { n: number }
      ).n,
      activeTaskCount: (
        db()
          .prepare(
            "SELECT count(*) n FROM tasks t JOIN lists l ON l.id=t.list_id WHERE l.project_id=? AND json_extract(t.data,'$.isCompleted')=0",
          )
          .get(p._id) as { n: number }
      ).n,
    }));
}
export function saveProject(input: unknown, userId: string, id?: string) {
  if (!id)
    insist(
      actorContext
        .getStore()
        ?.resourceRules?.every((rule) => rule.resourceMode === "all") ?? true,
      403,
      "Il token limitato non può creare nuovi progetti",
    );
  const previous = id ? getProject(id, userId, true) : undefined;
  const data = projectSchema.parse(
    previous ? { ...previous, ...(input as object) } : input,
  );
  insist(
    data.members.every((id) => byId(id)),
    400,
    "Uno o più membri non esistono",
  );
  const value: TodoProjectPlain = {
    ...data,
    members: data.members.filter((id) => id !== userId),
    _id: id || randomUUID(),
    createdBy: previous?.createdBy || userId,
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    transaction(() => {
      db()
        .prepare(
          "INSERT INTO projects(id,owner,slug,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,data=excluded.data",
        )
        .run(value._id, userId, data.slug, JSON.stringify(value));
      const lists = db()
        .prepare("SELECT id,data FROM lists WHERE project_id=?")
        .all(value._id) as { id: string; data: string }[];
      for (const row of lists) {
        const list = JSON.parse(row.data) as TodoListPlain,
          allowed = new Set([
            value.createdBy,
            ...value.members,
            list.createdBy,
            ...list.members,
          ]);
        for (const taskRow of db()
          .prepare("SELECT id,data FROM tasks WHERE list_id=?")
          .all(row.id) as { id: string; data: string }[]) {
          const task = JSON.parse(taskRow.data);
          if (task.assignedTo.some((id: string) => !allowed.has(id))) {
            task.assignedTo = task.assignedTo.filter((id: string) =>
              allowed.has(id),
            );
            task.updatedAt = new Date().toISOString();
            db()
              .prepare("UPDATE tasks SET data=? WHERE id=?")
              .run(JSON.stringify(task), taskRow.id);
          }
        }
      }
    });
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      throw new HttpError(409, "URL progetto già utilizzato");
    throw e;
  }
  return value;
}
export function deleteProject(id: string, userId: string) {
  getProject(id, userId, true);
  transaction(() => {
    const lists = db()
      .prepare("SELECT id,data FROM lists WHERE project_id=?")
      .all(id) as { id: string; data: string }[];
    for (const row of lists) {
      const list: TodoListPlain = JSON.parse(row.data);
      list.projectId = null;
      list.updatedAt = new Date().toISOString();
      db()
        .prepare("UPDATE lists SET project_id=NULL,data=? WHERE id=?")
        .run(JSON.stringify(list), row.id);
    }
    db().prepare("DELETE FROM projects WHERE id=?").run(id);
  });
}
export function projectMemberIds(projectId: string | null | undefined) {
  const p = projectId ? findProject(projectId) : undefined;
  return p ? [p.createdBy, ...p.members] : [];
}
