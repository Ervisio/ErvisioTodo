import { z } from "zod";
import { db, transaction } from "./db";
import { fileFor } from "./files";
import { getList, listsFor, writeTask } from "./todo";
import { tokenAllowsUpload } from "./api-policy";
import { insist } from "./security";
import type { TodoListPlain, TodoTaskPlain } from "@/types/todo";
function metadata(row: {
  id: string;
  owner: string;
  list_id: string | null;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}) {
  return {
    id: row.id,
    owner: row.owner,
    listId: row.list_id,
    name: row.name,
    mimeType: row.mime,
    size: row.size,
    createdAt: row.created_at,
    url: `/api/files/${row.id}`,
    downloadUrl: `/api/v1/files/${row.id}/download`,
  };
}
export function fileMetadata(id: string, userId: string) {
  const file = fileFor(id, userId);
  if (file.list_id) getList(file.list_id, userId);
  else insist(file.owner === userId, 404, "File non trovato");
  return metadata(
    db()
      .prepare(
        "SELECT id,owner,list_id,name,mime,length(bytes) size,created_at FROM uploads WHERE id=?",
      )
      .get(id) as any,
  );
}
export function accessibleFiles(userId: string, listId?: string | null) {
  if (listId) getList(listId, userId);
  const allowed = new Set(listsFor(userId).map((list) => list._id));
  return (
    db()
      .prepare(
        "SELECT id,owner,list_id,name,mime,length(bytes) size,created_at FROM uploads ORDER BY created_at DESC",
      )
      .all() as any[]
  )
    .filter(
      (row) =>
        (row.list_id ? allowed.has(row.list_id) : row.owner === userId) &&
        tokenAllowsUpload(row.list_id) &&
        (!listId || row.list_id === listId),
    )
    .map(metadata);
}
export function changeFile(id: string, userId: string, input?: unknown) {
  const file = fileFor(id, userId);
  if (file.list_id) getList(file.list_id, userId);
  else insist(file.owner === userId, 404, "File non trovato");
  const name =
      input === undefined
        ? undefined
        : z
            .object({
              name: z
                .string()
                .trim()
                .min(1)
                .max(255)
                .regex(/^[^\r\n\x00]+$/),
            })
            .strict()
            .parse(input).name,
    url = `/api/files/${id}`;
  transaction(() => {
    for (const row of db()
      .prepare("SELECT data FROM tasks WHERE list_id IS ?")
      .all(file.list_id) as { data: string }[]) {
      const task = JSON.parse(row.data) as TodoTaskPlain;
      if (task.attachments.some((a) => a.url === url))
        writeTask({
          ...task,
          attachments: name
            ? task.attachments.map((a) => (a.url === url ? { ...a, name } : a))
            : task.attachments.filter((a) => a.url !== url),
          updatedAt: new Date().toISOString(),
        });
    }
    if (name)
      db().prepare("UPDATE uploads SET name=? WHERE id=?").run(name, id);
    else {
      for (const row of db().prepare("SELECT id,data FROM lists").all() as {
        id: string;
        data: string;
      }[]) {
        const list = JSON.parse(row.data) as TodoListPlain;
        if (
          list.faviconUrl === url ||
          (list.iconType === "image" && list.iconValue === url)
        ) {
          if (list.faviconUrl === url) list.faviconUrl = "";
          if (list.iconType === "image" && list.iconValue === url) {
            list.iconType = "fontawesome";
            list.iconValue = "fa-solid fa-list-check";
          }
          db()
            .prepare("UPDATE lists SET data=? WHERE id=?")
            .run(JSON.stringify(list), row.id);
        }
      }
      db().prepare("DELETE FROM uploads WHERE id=?").run(id);
    }
  });
  return name ? fileMetadata(id, userId) : null;
}
export function downloadFile(id: string, userId: string) {
  const file = fileFor(id, userId);
  return new Response(file.bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
