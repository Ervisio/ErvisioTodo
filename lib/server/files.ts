import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";
import { insist } from "./security";
import { tokenAllowsUpload } from "./api-policy";
import { getList } from "./todo";
import {
  uploadLimitBytes,
  requestUploadLimitBytes,
  workspaceSettings,
  enforceStorageQuota,
} from "./settings";
export function sniffMime(bytes: Buffer) {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString()))
    return "image/gif";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])))
    return "image/x-icon";
  return "application/octet-stream";
}
export async function uploadFiles(request: Request, userId: string) {
  const limit = requestUploadLimitBytes();
  insist(
    Number(request.headers.get("content-length") || 0) <= limit + 64_000,
    413,
    "Caricamento oltre il limite tecnico del server",
  );
  insist(request.body, 400, "File richiesto");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit + 64_000) {
      await reader.cancel();
      insist(false, 413, "Caricamento oltre il limite tecnico del server");
    }
    chunks.push(value);
  }
  const bounded = new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }),
    form = await bounded.formData();
  const files = [...form.getAll("file"), ...form.getAll("files")];
  insist(
    files.length > 0 && files.every((f) => f instanceof File),
    400,
    "Scegli almeno un file",
  );
  const settings = workspaceSettings();
  insist(
    settings.maxFilesPerUpload === 0 ||
      files.length <= settings.maxFilesPerUpload,
    400,
    "Troppi file per un singolo caricamento",
  );
  const listId = form.get("listId");
  if (listId) getList(String(listId), userId);
  insist(
    tokenAllowsUpload(listId ? String(listId) : null),
    403,
    "Il token non consente questa destinazione",
  );
  const perFile = uploadLimitBytes();
  const entries = await Promise.all(
    (files as File[]).map(async (file) => {
      insist(
        file.size > 0 && file.size <= perFile,
        413,
        "Un allegato supera la dimensione massima configurata",
      );
      const bytes = Buffer.from(await file.arrayBuffer()),
        id = randomUUID(),
        name = file.name.slice(0, 255).replace(/[\r\n\x00]/g, "");
      return {
        id,
        name,
        mimeType: sniffMime(bytes),
        bytes,
        url: `/api/files/${id}`,
      };
    }),
  );
  transaction(() => {
    enforceStorageQuota(
      userId,
      entries.reduce((n, f) => n + f.bytes.length, 0),
    );
    for (const entry of entries)
      db()
        .prepare(
          "INSERT INTO uploads(id,owner,list_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          entry.id,
          userId,
          listId ? String(listId) : null,
          entry.name,
          entry.mimeType,
          entry.bytes,
          new Date().toISOString(),
        );
  });
  return entries.map(({ name, mimeType, url }) => ({ name, mimeType, url }));
}
export async function uploadFile(request: Request, userId: string) {
  return (await uploadFiles(request, userId))[0].url;
}
export function fileFor(id: string, userId?: string) {
  const row = db().prepare("SELECT * FROM uploads WHERE id=?").get(id) as
    | {
        id: string;
        owner: string;
        list_id: string | null;
        mime: string;
        name: string;
        bytes: Uint8Array;
      }
    | undefined;
  insist(row, 404, "File non trovato");
  insist(tokenAllowsUpload(row.list_id), 404, "File non trovato");
  const url = `/api/files/${id}`;
  const branded =
    row.mime.startsWith("image/") &&
    db()
      .prepare(
        "SELECT 1 FROM lists WHERE json_extract(data,'$.faviconUrl')=? OR (json_extract(data,'$.iconType')='image' AND json_extract(data,'$.iconValue')=?)",
      )
      .get(url, url);
  if (!branded) {
    insist(userId, 401, "Accedi per scaricare il file");
    if (row.list_id) getList(row.list_id, userId);
    else insist(row.owner === userId, 404, "File non trovato");
  }
  return { ...row, public: !!branded };
}
