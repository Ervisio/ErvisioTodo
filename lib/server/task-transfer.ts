import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import {
  getTask,
  getList,
  rawTasks,
  listMemberIds,
  writeTask,
  enrichTask,
} from "./todo";
import { enforceStorageQuota, recordActivity } from "./settings";
import { insist } from "./security";
import type { TodoTaskPlain } from "@/types/todo";
export function transferTask(
  id: string,
  input: unknown,
  userId: string,
  copy = false,
) {
  const data = z
      .object({
        listId: z.string().min(1),
        parentTaskId: z.string().nullable().default(null),
      })
      .strict()
      .parse(input),
    source = getTask(id, userId),
    destination = getList(data.listId, userId);
  const all = rawTasks(source.listId),
    branch = [source],
    seen = new Set([id]);
  for (let index = 0; index < branch.length; index++)
    for (const task of all)
      if (task.parentTaskId === branch[index]._id && !seen.has(task._id)) {
        seen.add(task._id);
        branch.push(task);
      }
  if (data.parentTaskId) {
    const parent = getTask(data.parentTaskId, userId);
    insist(
      parent.listId === destination._id && !parent.isCompleted,
      400,
      "Il padre deve essere attivo nella destinazione",
    );
    insist(
      copy || !seen.has(parent._id),
      400,
      "Uno spostamento non può creare cicli",
    );
  }
  const members = new Set(listMemberIds(destination)),
    remap = new Map(
      branch.map((task) => [task._id, copy ? randomUUID() : task._id]),
    ),
    uploads = new Map<string, string>(),
    cross = source.listId !== destination._id;
  const order =
    Math.max(
      -1,
      ...rawTasks(destination._id)
        .filter((task) => task.parentTaskId === data.parentTaskId)
        .map((task) => task.order),
    ) + 1;
  return transaction(() => {
    const result: TodoTaskPlain[] = [];
    for (const [index, task] of branch.entries()) {
      const attachments = task.attachments.map((attachment) => {
        if (!cross || !attachment.url.startsWith("/api/files/"))
          return attachment;
        const oldId = attachment.url.split("/").pop()!;
        let newId = uploads.get(oldId);
        if (!newId) {
          const row = db()
            .prepare("SELECT * FROM uploads WHERE id=? AND list_id=?")
            .get(oldId, source.listId) as
            { bytes: Uint8Array; name: string; mime: string } | undefined;
          insist(row, 400, "Allegato sorgente non disponibile");
          enforceStorageQuota(userId, row.bytes.byteLength);
          newId = randomUUID();
          uploads.set(oldId, newId);
          db()
            .prepare(
              "INSERT INTO uploads(id,owner,list_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?,?)",
            )
            .run(
              newId,
              userId,
              destination._id,
              row.name,
              row.mime,
              row.bytes,
              new Date().toISOString(),
            );
        }
        return { ...attachment, url: `/api/files/${newId}` };
      });
      const next: TodoTaskPlain = {
        ...task,
        _id: remap.get(task._id)!,
        listId: destination._id,
        parentTaskId:
          index === 0 ? data.parentTaskId : remap.get(task.parentTaskId!)!,
        order: index === 0 ? order : task.order,
        attachments,
        tags: cross ? [] : task.tags,
        assignedTo: task.assignedTo.filter((member) => members.has(member)),
        updatedAt: new Date().toISOString(),
        ...(copy
          ? {
              createdBy: userId,
              createdAt: new Date().toISOString(),
              isCompleted: false,
              completedAt: null,
              completedBy: null,
            }
          : {}),
      };
      writeTask(next);
      result.push(next);
    }
    recordActivity(userId, copy ? "task.copy" : "task.move", id);
    return { task: enrichTask(result[0]), tasks: result.map((t) => enrichTask(t)) };
  });
}
