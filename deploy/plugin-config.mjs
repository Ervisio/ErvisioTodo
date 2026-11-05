import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const protectedKeys = new Set([
  "NODE_ENV",
  "DATA_DIR",
  "BIND_HOST",
  "HOSTNAME",
  "PLUGIN_SECRET",
  "PLUGIN_SOCKET",
  "ERVISIO_SOCKET_DIR",
  "ERVISIO_VERSION",
  "PATH",
  "NODE_VERSION",
  "YARN_VERSION",
]);
export const isProtectedKey = (key) =>
  protectedKeys.has(key) || /^(?:COMPOSE|DOCKER|BUILDX)_/.test(key);
const knownSecrets = [
  "PLUGIN_SECRET",
  "AUTH_SECRET",
  "AUTH_GOOGLE_SECRET",
  "AUTH_DISCORD_SECRET",
  "AUTH_COGNITO_SECRET",
  "SMTP_URL",
  "AI_API_KEY",
];
export const isSecret = (key) =>
  knownSecrets.includes(key) || !knownKeys.has(key);
const knownKeys = new Set([
  ...protectedKeys,
  ...knownSecrets,
  "AUTH_URL",
  "BASE_DOMAIN",
  "AUTH_COOKIE_DOMAIN",
  "TRUSTED_IP_HEADER",
  "AUTH_LOCAL_ENABLED",
  "REGISTRATION_ENABLED",
  "REQUIRE_EMAIL_VERIFICATION",
  "AUTH_GOOGLE_ENABLED",
  "AUTH_GOOGLE_ID",
  "AUTH_DISCORD_ENABLED",
  "AUTH_DISCORD_ID",
  "AUTH_COGNITO_ENABLED",
  "AUTH_COGNITO_ID",
  "AUTH_COGNITO_ISSUER",
  "MAIL_FROM",
  "AI_BASE_URL",
  "AI_MODEL",
  "UPLOAD_MAX_MB",
  "STORAGE_QUOTA_GB",
  "UPLOAD_REQUEST_MAX_MB",
  "PORT",
]);

const booleanKeys = new Set([
  "AUTH_LOCAL_ENABLED",
  "REGISTRATION_ENABLED",
  "REQUIRE_EMAIL_VERIFICATION",
  "AUTH_GOOGLE_ENABLED",
  "AUTH_DISCORD_ENABLED",
  "AUTH_COGNITO_ENABLED",
]);

export function parseDocument(source) {
  const entries = [];
  const assignment =
    /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*/gm;
  let match;
  while ((match = assignment.exec(source))) {
    const start = match.index;
    let pos = assignment.lastIndex;
    const quote = source[pos];
    let value = "";
    if (quote === '"' || quote === "'") {
      pos++;
      let closed = false;
      while (pos < source.length) {
        const ch = source[pos++];
        if (ch === quote) {
          closed = true;
          break;
        }
        if (ch === "\\" && pos < source.length) {
          const next = source[pos];
          if (next === quote || (quote === '"' && "\\nrt".includes(next))) {
            pos++;
            value +=
              quote === '"'
                ? ({ n: "\n", r: "\r", t: "\t" }[next] ?? next)
                : next;
            continue;
          }
        }
        value += ch;
      }
      if (!closed) throw new Error(`Invalid quoted value: ${match[1]}`);
    } else {
      const end = source.indexOf("\n", pos);
      value = source
        .slice(pos, end < 0 ? source.length : end)
        .replace(/\s+#.*$/, "")
        .trim();
      pos = end < 0 ? source.length : end;
    }
    const end = source.indexOf("\n", pos);
    entries.push({
      key: match[1],
      value: quote === "'" ? value : value.replaceAll("$$", "$"),
      start,
      end: end < 0 ? source.length : end + 1,
    });
    assignment.lastIndex = end < 0 ? source.length : end + 1;
  }
  return entries;
}

export function patchDocument(source, changes) {
  const quote = (value) => JSON.stringify(value).replaceAll("$", () => "$$");
  const pending = new Map(Object.entries(changes));
  let result = "";
  let offset = 0;
  for (const entry of parseDocument(source)) {
    result += source.slice(offset, entry.start);
    if (Object.hasOwn(changes, entry.key)) {
      if (
        pending.has(entry.key) &&
        !(booleanKeys.has(entry.key) && changes[entry.key] === "")
      )
        result += `${entry.key}=${quote(changes[entry.key])}\n`;
      pending.delete(entry.key);
    } else result += source.slice(entry.start, entry.end);
    offset = entry.end;
  }
  result += source.slice(offset);
  if (pending.size && result && !result.endsWith("\n")) result += "\n";
  for (const [key, value] of pending) {
    if (booleanKeys.has(key) && value === "") continue;
    result += `${key}=${quote(value)}\n`;
  }
  return result;
}

const valuesOf = (source) =>
  Object.fromEntries(
    parseDocument(source).map(({ key, value }) => [key, value]),
  );
const revisionOf = (source) =>
  createHash("sha256").update(source).digest("hex");
const envOf = (inspection) =>
  Object.fromEntries(
    (inspection?.[0]?.Config?.Env ?? []).map((item) => {
      const index = item.indexOf("=");
      return [item.slice(0, index), item.slice(index + 1)];
    }),
  );

export function ensureContainerPort(directory) {
  const file = path.join(directory, "compose.yaml");
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8");
  if (/^      PORT:/m.test(source)) return;
  const next = source.replace(
    /^(      DATA_DIR: \/app\/data\r?\n)/m,
    '$1      PORT: "3000"\n',
  );
  if (next === source) return;
  fs.writeFileSync(`${file}.bak-${randomUUID()}`, source, {
    flag: "wx",
    mode: 0o600,
  });
  const temp = path.join(directory, ".plugin-config", "compose.next");
  fs.writeFileSync(temp, next, { mode: 0o600 });
  fs.renameSync(temp, file);
}

export function validate(values) {
  if (!values.AUTH_SECRET || values.AUTH_SECRET.length < 32)
    throw new Error("AUTH_SECRET: minimum 32 characters");
  let url;
  try {
    url = new URL(values.AUTH_URL);
  } catch {
    throw new Error("AUTH_URL: invalid public URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "AUTH_URL: use an HTTP(S) origin without path or credentials",
    );
  const base = values.BASE_DOMAIN || "";
  if (
    base &&
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(base)
  )
    throw new Error("BASE_DOMAIN: invalid domain");
  const cookie = values.AUTH_COOKIE_DOMAIN?.replace(/^\./, "");
  if (
    cookie &&
    (cookie !== base ||
      !(url.hostname === base || url.hostname.endsWith(`.${base}`)))
  )
    throw new Error(
      "AUTH_COOKIE_DOMAIN: must match BASE_DOMAIN and include AUTH_URL",
    );
  for (const key of booleanKeys)
    if (values[key] !== undefined && !["true", "false"].includes(values[key]))
      throw new Error(`${key}: use true or false`);
  for (const key of [
    "UPLOAD_MAX_MB",
    "STORAGE_QUOTA_GB",
    "UPLOAD_REQUEST_MAX_MB",
  ])
    if (
      values[key] &&
      (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0)
    )
      throw new Error(`${key}: use a non-negative number`);
  if (
    values.PORT &&
    (!/^\d+$/.test(values.PORT) ||
      Number(values.PORT) < 1 ||
      Number(values.PORT) > 65535)
  )
    throw new Error("PORT: use a port from 1 to 65535");
  if (values.REQUIRE_EMAIL_VERIFICATION === "true" && !values.SMTP_URL)
    throw new Error("SMTP_URL: required for email verification");
  if (values.SMTP_URL) {
    let smtp;
    try {
      smtp = new URL(values.SMTP_URL);
    } catch {
      throw new Error("SMTP_URL: invalid URL");
    }
    if (!["smtp:", "smtps:"].includes(smtp.protocol))
      throw new Error("SMTP_URL: use smtp:// or smtps://");
  }
}

export function run(mode, directory = "/deployment", version) {
  if (!["read", "recover", "apply"].includes(mode))
    throw new Error("Unknown configuration operation");
  if (mode === "apply" && !/^[a-f0-9]{32}$/.test(version ?? ""))
    throw new Error("Invalid configuration request id");
  if (mode === "recover" && !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version ?? ""))
    throw new Error("Invalid release version");
  const file = path.join(directory, ".env");
  const state = path.join(directory, ".plugin-config");
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  fs.chmodSync(state, 0o700);
  const requests = path.join(state, "requests");
  fs.mkdirSync(requests, { recursive: true, mode: 0o700 });
  fs.chmodSync(requests, 0o700);
  if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
  const read = () => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  const write = (source) => {
    if (fs.existsSync(file))
      fs.writeFileSync(
        path.join(directory, `.env.bak-${Date.now()}-${randomUUID()}`),
        fs.readFileSync(file),
        { mode: 0o600, flag: "wx" },
      );
    const temp = path.join(state, "env.next");
    fs.writeFileSync(temp, source, { mode: 0o600 });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, file);
  };
  let source = read();
  if (!fs.existsSync(path.join(state, "migrated"))) {
    const inspect = (name) => {
      const target = path.join(state, name);
      if (!fs.existsSync(target)) return [];
      try {
        return JSON.parse(fs.readFileSync(target, "utf8"));
      } catch {
        throw new Error("Cannot read Docker environment inspection");
      }
    };
    const live = envOf(inspect("container.json"));
    const image = envOf(inspect("image.json"));
    const recovered = Object.fromEntries(
      Object.entries(live).filter(
        ([key, value]) =>
          /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) &&
          !isProtectedKey(key) &&
          key !== "PORT" &&
          image[key] !== value,
      ),
    );
    const migrated = patchDocument(source, recovered);
    validate(valuesOf(migrated));
    if (migrated !== source) {
      write(migrated);
      source = migrated;
    }
    fs.writeFileSync(path.join(state, "migrated"), "1\n", { mode: 0o600 });
  }
  if (mode === "read") {
    const all = valuesOf(source);
    const secrets = [
      ...new Set([...knownSecrets, ...Object.keys(all).filter(isSecret)]),
    ];
    return {
      revision: revisionOf(source),
      values: Object.fromEntries(
        Object.entries(all).filter(([key]) => !isSecret(key)),
      ),
      secrets,
      configured: secrets.filter((key) => all[key]),
    };
  }
  if (mode === "recover") {
    validate(valuesOf(source));
    ensureContainerPort(directory);
    write(patchDocument(source, { ERVISIO_VERSION: version }));
    return { saved: true };
  }
  const requestPath = path.join(requests, `${version}.json`);
  let request;
  try {
    const contents = fs.readFileSync(requestPath, "utf8");
    try {
      request = JSON.parse(contents);
    } catch {
      throw new Error("Invalid configuration request JSON");
    }
  } finally {
    fs.rmSync(requestPath, { force: true });
  }
  if (!request || typeof request !== "object" || Array.isArray(request))
    throw new Error("Invalid configuration request");
  if (request.revision !== revisionOf(source))
    throw new Error("Configuration changed. Reload before saving.");
  if (
    !request.changes ||
    typeof request.changes !== "object" ||
    Array.isArray(request.changes)
  )
    throw new Error("Invalid configuration changes");
  for (const [key, value] of Object.entries(request.changes)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || isProtectedKey(key))
      throw new Error(`Configuration key is protected or invalid: ${key}`);
    if (
      typeof value !== "string" ||
      value.length > 8192 ||
      value.includes("\0")
    )
      throw new Error(`Invalid value: ${key}`);
  }
  const next = patchDocument(source, request.changes);
  validate(valuesOf(next));
  ensureContainerPort(directory);
  write(next);
  return { saved: true };
}

if (
  process.argv[1] === "read" ||
  process.argv[1] === "recover" ||
  process.argv[1] === "apply"
) {
  try {
    console.log(
      JSON.stringify(run(process.argv[1], "/deployment", process.argv[2])),
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Configuration failed",
    );
    process.exitCode = 1;
  }
}
