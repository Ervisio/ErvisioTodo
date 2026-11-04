import { z } from "zod";
import { db, transaction } from "./db";
import { insist } from "./security";
import {
  authSettings,
  providerConfigured,
  canonicalUrl,
  baseDomain,
} from "./config";
const number = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const workspaceSchema = z.object({
  siteName: z.string().trim().min(1).max(60).default("ErvisioTodo"),
  defaultLocale: z.enum(["it", "en"]).default("it"),
  uploadMaxMb: number.nullable().default(null),
  storageQuotaGb: number.nullable().default(null),
  userQuotaGb: number.default(0),
  maxFilesPerUpload: number.int().default(0),
  maxAttachmentsPerTask: number.int().default(30),
  editorMaxMb: number.default(0.0625),
  writeRequestsPerMinute: number.int().default(240),
  statsRetentionDays: number.int().default(365),
  sharingEnabled: z.boolean().default(true),
  maxShareLifetimeHours: number.default(0),
  apiEnabled: z.boolean().default(true),
  membersCanCreateTokens: z.boolean().default(true),
  defaultTokenLifetimeDays: number.int().min(1).default(30),
  maxTokenLifetimeDays: number.int().min(1).default(365),
  apiRequestsPerMinute: number.int().default(120),
});
export type WorkspaceSettings = z.infer<typeof workspaceSchema>;
export function workspaceSettings(): WorkspaceSettings {
  const row = db()
    .prepare("SELECT value FROM settings WHERE key=?")
    .get("workspace") as { value: string } | undefined;
  return workspaceSchema.parse(row ? JSON.parse(row.value) : {});
}
function envNumber(key: string, fallback: number) {
  const n = Number(process.env[key] ?? fallback);
  insist(Number.isFinite(n) && n >= 0, 500, `${key} non valido`);
  return n;
}
export function settingsEnvironment() {
  return {
    uploadMaxMb: envNumber("UPLOAD_MAX_MB", 10),
    quotaGb: envNumber("STORAGE_QUOTA_GB", 0),
    maxRequestMb: envNumber("UPLOAD_REQUEST_MAX_MB", 512),
    trustProxy: !!process.env.TRUSTED_IP_HEADER,
    callbackBase: canonicalUrl(),
    baseDomain: baseDomain(),
    cognitoIssuer: process.env.AUTH_COGNITO_ISSUER || "",
    smtpConfigured: !!process.env.SMTP_URL,
    configured: providerConfigured(),
  };
}
export function storageUsage(userId?: string) {
  const row = db()
    .prepare(
      `SELECT coalesce(sum(length(bytes)),0) bytes,count(*) files FROM uploads${userId ? " WHERE owner=?" : ""}`,
    )
    .get(...(userId ? [userId] : [])) as { bytes: number; files: number };
  return row;
}
export function uploadLimitBytes() {
  const settings = workspaceSettings(),
    mb = settings.uploadMaxMb ?? settingsEnvironment().uploadMaxMb;
  return mb === 0 ? Infinity : Math.floor(mb * 1024 * 1024);
}
export function requestUploadLimitBytes() {
  const mb = settingsEnvironment().maxRequestMb;
  return mb === 0
    ? 512 * 1024 * 1024
    : Math.min(mb * 1024 * 1024, 512 * 1024 * 1024);
}
export function enforceStorageQuota(userId: string, additionalBytes: number) {
  const settings = workspaceSettings(),
    total = settings.storageQuotaGb ?? settingsEnvironment().quotaGb,
    perUser = settings.userQuotaGb;
  if (total > 0)
    insist(
      storageUsage().bytes + additionalBytes <= total * 1024 ** 3,
      413,
      "Spazio totale per gli allegati esaurito",
    );
  if (perUser > 0)
    insist(
      storageUsage(userId).bytes + additionalBytes <= perUser * 1024 ** 3,
      413,
      "Quota personale per gli allegati esaurita",
    );
}
export function pruneActivity() {
  const days = workspaceSettings().statsRetentionDays;
  if (days > 0)
    db()
      .prepare("DELETE FROM activity WHERE created_at<?")
      .run(Date.now() - days * 86400000);
}
export function recordActivity(
  actor: string | null,
  action: string,
  resource = "",
) {
  pruneActivity();
  db()
    .prepare(
      "INSERT INTO activity(actor,action,resource,created_at) VALUES(?,?,?,?)",
    )
    .run(actor, action.slice(0, 100), resource.slice(0, 255), Date.now());
}
const authPatch = z.object({
  credentials: z.boolean().optional(),
  google: z.boolean().optional(),
  discord: z.boolean().optional(),
  cognito: z.boolean().optional(),
  registration: z.boolean().optional(),
});
export const settingsPatchSchema = workspaceSchema
  .partial()
  .extend(authPatch.shape)
  .strict();
export function saveSettings(input: unknown) {
  const changes = settingsPatchSchema.parse(input),
    currentAuth = authSettings(),
    nextAuth = { ...currentAuth },
    configured = providerConfigured();
  for (const key of Object.keys(
    authPatch.shape,
  ) as (keyof typeof currentAuth)[])
    if (changes[key] !== undefined) nextAuth[key] = changes[key]!;
  insist(
    Object.keys(configured).some(
      (k) =>
        nextAuth[k as keyof typeof configured] &&
        configured[k as keyof typeof configured],
    ),
    400,
    "Mantieni almeno un metodo di accesso configurato e attivo",
  );
  for (const k of ["google", "discord", "cognito"] as const)
    if (changes[k])
      insist(
        configured[k],
        400,
        `Configura le credenziali ${k} nell’ambiente prima di attivarlo`,
      );
  const workspaceChanges = Object.fromEntries(
    Object.entries(changes).filter(
      ([key]) =>
        key in workspaceSchema.shape && Object.hasOwn(input as object, key),
    ),
  );
  const next = workspaceSchema.parse({
    ...workspaceSettings(),
    ...workspaceChanges,
  });
  insist(
    next.defaultTokenLifetimeDays <= next.maxTokenLifetimeDays,
    400,
    "La durata predefinita dei token supera quella massima",
  );
  transaction(() => {
    for (const [key, value] of [
      ["auth", nextAuth],
      ["workspace", next],
    ] as const)
      db()
        .prepare(
          "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(key, JSON.stringify(value));
    pruneActivity();
  });
  return next;
}
