import { db } from "./db";
import { authSettings, canonicalUrl, flag, providerConfigured } from "./config";
import { storageUsage, workspaceSchema, workspaceSettings } from "./settings";
import { APP_VERSION } from "../version";

const count = (sql: string) => (db().prepare(sql).get() as { n: number }).n;

export function pluginStatus() {
  const configured = providerConfigured(),
    auth = authSettings(),
    settings = workspaceSettings(),
    quotaGb =
      settings.storageQuotaGb ?? Number(process.env.STORAGE_QUOTA_GB || 0);
  return {
    version: APP_VERSION,
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    publicUrl: canonicalUrl(),
    restartRequired: false,
    mailEnabled: !!process.env.SMTP_URL,
    providers: {
      credentials: auth.credentials,
      google: auth.google && configured.google,
      discord: auth.discord && configured.discord,
      cognito: auth.cognito && configured.cognito,
    },
    counts: {
      users: count("SELECT count(*) n FROM users"),
      lists: count("SELECT count(*) n FROM lists"),
      tasks: count("SELECT count(*) n FROM tasks WHERE parent_id IS NULL"),
      openTasks: count(
        "SELECT count(*) n FROM tasks WHERE parent_id IS NULL AND coalesce(json_extract(data,'$.isCompleted'),0)=0",
      ),
    },
    storage: {
      usedBytes: storageUsage().bytes,
      quotaBytes: quotaGb > 0 ? Math.round(quotaGb * 1024 ** 3) : null,
    },
  };
}

export function pluginSettings() {
  return {
    values: { ...workspaceSettings(), ...authSettings() },
    defaults: {
      ...workspaceSchema.parse({}),
      credentials: flag("AUTH_LOCAL_ENABLED", true),
      google: flag("AUTH_GOOGLE_ENABLED", false),
      discord: flag("AUTH_DISCORD_ENABLED", false),
      cognito: flag("AUTH_COGNITO_ENABLED", false),
      registration: flag("REGISTRATION_ENABLED", true),
    },
    configured: (({ google, discord, cognito }) => ({
      google,
      discord,
      cognito,
    }))(providerConfigured()),
    restartRequired: false,
  };
}
