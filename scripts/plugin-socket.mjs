// Unix-socket proxy for the Ervisio plugin: exposes only /api/plugin/* of the
// local Next server and adds the per-process secret the route guard checks.
import { randomBytes } from "node:crypto";
import { chmodSync, rmSync } from "node:fs";
import http from "node:http";

export const MAX_BODY_BYTES = 1024 * 1024;
const PREFIX = "/api/plugin/";

function problem(res, status, title, detail) {
  if (res.headersSent) return res.destroy();
  const body = JSON.stringify({ title, status, detail });
  res.writeHead(status, {
    "content-type": "application/problem+json",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    connection: "close",
  });
  res.end(body);
}

export function createPluginProxy({
  secret,
  upstreamPort,
  upstreamHost = "127.0.0.1",
  maxBody = MAX_BODY_BYTES,
}) {
  return http.createServer((req, res) => {
    let target;
    try {
      target = new URL(req.url ?? "", "http://plugin.invalid");
    } catch {
      return problem(res, 404, "Not Found", "Unknown route");
    }
    if (!target.pathname.startsWith(PREFIX))
      return problem(res, 404, "Not Found", "Unknown route");
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > maxBody) {
      req.resume();
      return problem(res, 413, "Payload Too Large", "Body over 1 MiB");
    }
    const headers = { ...req.headers };
    delete headers["x-ervisio-plugin"];
    delete headers["transfer-encoding"];
    headers.host = `${upstreamHost}:${upstreamPort}`;
    headers["x-ervisio-plugin"] = secret;
    const upstream = http.request(
      {
        host: upstreamHost,
        port: upstreamPort,
        method: req.method,
        path: target.pathname + target.search,
        headers,
      },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on("error", () =>
      problem(res, 502, "Bad Gateway", "ErvisioTodo is not reachable"),
    );
    let received = 0;
    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > maxBody) {
        upstream.destroy();
        req.unpipe(upstream);
        req.resume();
        problem(res, 413, "Payload Too Large", "Body over 1 MiB");
      }
    });
    req.on("aborted", () => upstream.destroy());
    req.pipe(upstream);
  });
}

// Starts the proxy when PLUGIN_SOCKET (or options.path) is set. Must run before
// the Next server loads: it sets process.env.PLUGIN_SECRET for the route guard.
export async function startPluginSocket(options = {}) {
  const path = options.path ?? process.env.PLUGIN_SOCKET;
  if (!path) {
    delete process.env.PLUGIN_SECRET;
    return null;
  }
  const secret = options.secret ?? randomBytes(32).toString("hex");
  process.env.PLUGIN_SECRET = secret;
  const server = createPluginProxy({
    secret,
    upstreamPort: options.upstreamPort ?? Number(process.env.PORT || 3000),
    upstreamHost: options.upstreamHost,
    maxBody: options.maxBody,
  });
  rmSync(path, { force: true });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, resolve);
  });
  try {
    chmodSync(path, 0o660);
  } catch {
    // Windows has no POSIX modes.
  }
  const cleanup = () => rmSync(path, { force: true });
  process.once("exit", cleanup);
  return {
    server,
    path,
    close: () =>
      new Promise((resolve) => {
        process.off("exit", cleanup);
        server.close(() => {
          cleanup();
          resolve();
        });
        server.closeAllConnections();
      }),
  };
}
