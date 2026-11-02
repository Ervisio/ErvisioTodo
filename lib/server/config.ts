import { db } from "./db";
import { workspaceSettings, uploadLimitBytes } from "./settings";
export const flag = (name: string, fallback: boolean) =>
  process.env[name] === undefined ? fallback : process.env[name] === "true";
export function canonicalUrl() {
  const url = new URL(process.env.AUTH_URL || "http://localhost:3000");
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("AUTH_URL deve essere una origine http(s), senza percorso");
  return url.origin;
}
export function baseDomain() {
  const domain = (process.env.BASE_DOMAIN || "").trim().toLowerCase();
  if (
    domain &&
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
  )
    throw new Error("BASE_DOMAIN non valido");
  return domain;
}
export const providerConfigured = () => ({
  credentials: true,
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  discord: !!(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
  cognito: !!(
    process.env.AUTH_COGNITO_ID &&
    process.env.AUTH_COGNITO_SECRET &&
    process.env.AUTH_COGNITO_ISSUER
  ),
});
export type AuthSettings = {
  credentials: boolean;
  google: boolean;
  discord: boolean;
  cognito: boolean;
  registration: boolean;
};
export function authSettings(): AuthSettings {
  const row = db()
    .prepare("SELECT value FROM settings WHERE key=?")
    .get("auth") as { value: string } | undefined;
  const saved = row ? JSON.parse(row.value) : {};
  return {
    credentials: flag("AUTH_LOCAL_ENABLED", true),
    google: flag("AUTH_GOOGLE_ENABLED", false),
    discord: flag("AUTH_DISCORD_ENABLED", false),
    cognito: flag("AUTH_COGNITO_ENABLED", false),
    registration: flag("REGISTRATION_ENABLED", true),
    ...saved,
  };
}
export function availableProviders() {
  const settings = authSettings(),
    configured = providerConfigured();
  return Object.fromEntries(
    Object.keys(configured).map((k) => [
      k,
      settings[k as keyof typeof configured] &&
        configured[k as keyof typeof configured],
    ]),
  ) as ReturnType<typeof providerConfigured>;
}
export function publicConfig() {
  return {
    siteName: workspaceSettings().siteName,
    defaultLocale: workspaceSettings().defaultLocale,
    sharingEnabled: workspaceSettings().sharingEnabled,
    apiEnabled: workspaceSettings().apiEnabled,
    membersCanCreateTokens: workspaceSettings().membersCanCreateTokens,
    maxTokenLifetimeDays: workspaceSettings().maxTokenLifetimeDays,
    defaultTokenLifetimeDays: workspaceSettings().defaultTokenLifetimeDays,
    uploadMaxMb: Number.isFinite(uploadLimitBytes())
      ? uploadLimitBytes() / 1024 ** 2
      : 0,
    maxFilesPerUpload: workspaceSettings().maxFilesPerUpload,
    editorMaxMb: workspaceSettings().editorMaxMb,
    providers: availableProviders(),
    registration: authSettings().registration,
    baseDomain: baseDomain(),
    canonicalUrl: canonicalUrl(),
    passwordRecovery: !!process.env.SMTP_URL,
    emailVerification: flag("REQUIRE_EMAIL_VERIFICATION", false),
    aiEnabled: !!(
      process.env.AI_API_KEY &&
      process.env.AI_BASE_URL &&
      process.env.AI_MODEL
    ),
  };
}
export function assertConfig() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)
    throw new Error(
      "Eseguire npm run setup: AUTH_SECRET deve contenere almeno 32 caratteri",
    );
  canonicalUrl();
  const base = baseDomain();
  const cookie = process.env.AUTH_COOKIE_DOMAIN;
  if (
    cookie &&
    (!base ||
      cookie.replace(/^\./, "") !== base ||
      !(
        new URL(canonicalUrl()).hostname === base ||
        new URL(canonicalUrl()).hostname.endsWith("." + base)
      ))
  )
    throw new Error(
      "AUTH_COOKIE_DOMAIN deve corrispondere a BASE_DOMAIN e includere AUTH_URL",
    );
  if (flag("REQUIRE_EMAIL_VERIFICATION", false) && !process.env.SMTP_URL)
    throw new Error("SMTP_URL necessario per verificare email");
}
