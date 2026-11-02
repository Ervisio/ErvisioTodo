import { createHash } from "node:crypto";
import { db, transaction } from "./db";
import { baseDomain, canonicalUrl } from "./config";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function insist(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function rateLimit(key: string, max = 10, windowMs = 15 * 60_000) {
  const now = Date.now(),
    id = digest(key);
  transaction(() => {
    db().prepare("DELETE FROM limits WHERE expires < ?").run(now);
    const row = db().prepare("SELECT hits FROM limits WHERE key=?").get(id) as
      { hits: number } | undefined;
    insist(!row || row.hits < max, 429, "Troppi tentativi. Riprova più tardi.");
    db()
      .prepare(
        "INSERT INTO limits(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1",
      )
      .run(id, now + windowMs);
  });
}
export function clientAddress(request: Request) {
  // Set only behind a proxy that overwrites this header; never trust forwarded headers by default.
  return process.env.TRUSTED_IP_HEADER
    ? request.headers.get(process.env.TRUSTED_IP_HEADER)?.slice(0, 100) ||
        "unknown"
    : "direct";
}
export function allowedHost(hostname: string) {
  const host = hostname.toLowerCase(),
    canonical = new URL(canonicalUrl()).hostname;
  if (host === canonical) return true;
  const base = baseDomain();
  if (!base || !host.endsWith("." + base)) return false;
  const sub = host.slice(0, -(base.length + 1));
  return (
    /^[a-z0-9-]+$/.test(sub) &&
    !!db().prepare("SELECT 1 FROM lists WHERE subdomain=?").get(sub)
  );
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  insist(origin, 403, "Origin richiesto");
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new HttpError(403, "Origin non valido");
  }
  const host = request.headers.get("host") || new URL(request.url).host;
  insist(
    url.host.toLowerCase() === host.toLowerCase() &&
      allowedHost(url.hostname) &&
      ["http:", "https:"].includes(url.protocol),
    403,
    "Origine non consentita",
  );
  if (new URL(canonicalUrl()).protocol === "https:")
    insist(url.protocol === "https:", 403, "HTTPS richiesto");
}
export function safeReturnTo(value: string | null | undefined) {
  if (!value) return canonicalUrl();
  try {
    const url = new URL(value, canonicalUrl());
    if (
      !url.username &&
      !url.password &&
      allowedHost(url.hostname) &&
      url.protocol === new URL(canonicalUrl()).protocol &&
      (!url.port || url.port === new URL(canonicalUrl()).port)
    ) {
      if (
        url.hostname !== new URL(canonicalUrl()).hostname &&
        !process.env.AUTH_COOKIE_DOMAIN
      ) {
        const base = baseDomain(),
          sub = url.hostname.slice(0, -(base.length + 1));
        const row = db()
          .prepare("SELECT slug FROM lists WHERE subdomain=?")
          .get(sub) as { slug: string } | undefined;
        return row ? `${canonicalUrl()}/l/${row.slug}` : canonicalUrl();
      }
      return url.href;
    }
  } catch {}
  return canonicalUrl();
}
export async function jsonBody(request: Request) {
  insist(
    Number(request.headers.get("content-length") || 0) <= 4_200_000,
    413,
    "Richiesta troppo grande",
  );
  const raw = await request.text();
  insist(Buffer.byteLength(raw) <= 4_200_000, 413, "Richiesta troppo grande");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON non valido");
  }
}
