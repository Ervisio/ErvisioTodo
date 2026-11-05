/**
 * The editable settings: which section shows each key, how it is edited, and the checks the app makes
 * (lib/server/settings.ts), so a wrong value is caught on the row before it is sent. The server stays the judge: its
 * 422 errors replace these messages.
 */
import type { SettingValue } from "../api/todo";
import { t } from "./util";

export type SectionId = "general" | "limits" | "auth" | "api" | "deployment";
export const SECTIONS: SectionId[] = [
  "general",
  "limits",
  "auth",
  "api",
  "deployment",
];

export type Field =
  /** Free text, 1 to `max` characters. */
  | { kind: "text"; max: number }
  | { kind: "enum"; options: string[] }
  | { kind: "bool" }
  /**
   * A number. With `limit`, 0 means no limit and the control offers Limit / Unlimited (and Server for `env`, where null
   * takes the value from the installation's environment). Without it, 0 is just 0.
   */
  | {
      kind: "num";
      unit: Unit;
      min: number;
      int?: boolean;
      limit?: boolean;
      env?: boolean;
      fallback: number;
    };

export type Unit = "GB" | "MB" | "files" | "perMin" | "days" | "hours";

export const FIELDS: Record<string, Field & { section: SectionId }> = {
  siteName: { section: "general", kind: "text", max: 60 },
  defaultLocale: { section: "general", kind: "enum", options: ["it", "en"] },

  storageQuotaGb: {
    section: "limits",
    kind: "num",
    unit: "GB",
    min: 0,
    limit: true,
    env: true,
    fallback: 1,
  },
  userQuotaGb: {
    section: "limits",
    kind: "num",
    unit: "GB",
    min: 0,
    limit: true,
    fallback: 1,
  },
  uploadMaxMb: {
    section: "limits",
    kind: "num",
    unit: "MB",
    min: 0,
    limit: true,
    env: true,
    fallback: 10,
  },
  maxFilesPerUpload: {
    section: "limits",
    kind: "num",
    unit: "files",
    min: 0,
    int: true,
    limit: true,
    fallback: 10,
  },
  maxAttachmentsPerTask: {
    section: "limits",
    kind: "num",
    unit: "files",
    min: 0,
    int: true,
    limit: true,
    fallback: 30,
  },
  editorMaxMb: {
    section: "limits",
    kind: "num",
    unit: "MB",
    min: 0,
    limit: true,
    fallback: 0.0625,
  },
  writeRequestsPerMinute: {
    section: "limits",
    kind: "num",
    unit: "perMin",
    min: 0,
    int: true,
    limit: true,
    fallback: 240,
  },
  apiRequestsPerMinute: {
    section: "limits",
    kind: "num",
    unit: "perMin",
    min: 0,
    int: true,
    limit: true,
    fallback: 120,
  },
  statsRetentionDays: {
    section: "limits",
    kind: "num",
    unit: "days",
    min: 0,
    int: true,
    limit: true,
    fallback: 365,
  },

  credentials: { section: "auth", kind: "bool" },
  registration: { section: "auth", kind: "bool" },
  google: { section: "auth", kind: "bool" },
  discord: { section: "auth", kind: "bool" },
  cognito: { section: "auth", kind: "bool" },

  apiEnabled: { section: "api", kind: "bool" },
  membersCanCreateTokens: { section: "api", kind: "bool" },
  defaultTokenLifetimeDays: {
    section: "api",
    kind: "num",
    unit: "days",
    min: 1,
    int: true,
    fallback: 30,
  },
  maxTokenLifetimeDays: {
    section: "api",
    kind: "num",
    unit: "days",
    min: 1,
    int: true,
    fallback: 365,
  },
  sharingEnabled: { section: "api", kind: "bool" },
  maxShareLifetimeHours: {
    section: "api",
    kind: "num",
    unit: "hours",
    min: 0,
    limit: true,
    fallback: 24,
  },
};

/** Text shown for a value (the default in a row, the value of a limit). */
export function display(k: string, v: SettingValue | undefined): string {
  const f = FIELDS[k];
  if (v === undefined) return "";
  if (v === null) return t("lim.server");
  if (!f) return String(v);
  if (f.kind === "bool") return t(v ? "on" : "off");
  if (f.kind === "enum") return t(`opt.${k}.${v}`);
  if (f.kind === "num")
    return v === 0 && f.limit
      ? t("lim.unlimited")
      : `${v} ${t(`unit.${f.unit}`)}`;
  return String(v);
}

export const same = (
  a: SettingValue | undefined,
  b: SettingValue | undefined,
) => a === b;

/** A message when `v` is not acceptable for the key, else ''. */
export function check(k: string, v: SettingValue): string {
  const f = FIELDS[k];
  if (!f) return "";
  if (f.kind === "text") {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return t("chk.required");
    if (s.length > f.max) return t("chk.maxLen", { n: f.max });
  }
  if (f.kind === "num") {
    if (v === null) return f.env ? "" : t("chk.number");
    if (typeof v !== "number" || !Number.isFinite(v)) return t("chk.number");
    if (v < f.min) return t("chk.min", { n: f.min });
    if (f.int && !Number.isInteger(v)) return t("chk.int");
  }
  return "";
}

/** Parses what was typed in a number field: a number, or NaN when it is not one. Accepts a decimal comma. */
export function parseNumber(text: string): number {
  const s = text.trim().replace(",", ".");
  return s === "" ? NaN : Number(s);
}
