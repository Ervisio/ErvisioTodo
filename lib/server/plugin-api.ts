import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { HttpError } from "./security";

const MAX_BODY = 1024 * 1024;
export type PluginError = { path: string; msg: string };

export function pluginAuthorised(request: Request) {
  const secret = process.env.PLUGIN_SECRET,
    given = request.headers.get("x-ervisio-plugin");
  if (!secret || !given) return false;
  const a = Buffer.from(secret),
    b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function problem(
  status: number,
  title: string,
  detail: string,
  errors?: PluginError[],
) {
  return new Response(
    JSON.stringify({ title, status, detail, ...(errors && { errors }) }),
    {
      status,
      headers: {
        "content-type": "application/problem+json",
        "cache-control": "no-store",
      },
    },
  );
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function pluginBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY)
    throw new HttpError(413, "Body over 1 MiB");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

function validation(issues: ZodError["issues"]) {
  const errors = issues.flatMap((issue) => {
    // Unknown keys of a strict object are reported on the parent: name each key.
    if (issue.code === "unrecognized_keys")
      return issue.keys.map((key) => ({
        path: [...issue.path, key].join("."),
        msg: "Unknown setting",
      }));
    return [{ path: issue.path.join("."), msg: issue.message }];
  });
  return problem(422, "Validation failed", "Invalid settings", errors);
}

// Guard shared by every /api/plugin/* handler: anything but a valid secret is
// indistinguishable from an unknown route.
export function pluginRoute(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (!pluginAuthorised(request))
      return new Response("404 page not found", { status: 404 });
    try {
      return await handler(request);
    } catch (e) {
      if (e instanceof ZodError) return validation(e.issues);
      if (e instanceof HttpError) {
        if (e.status === 400 && e.message !== "Invalid JSON")
          return problem(422, "Validation failed", e.message, [
            { path: "", msg: e.message },
          ]);
        return problem(e.status, e.message, e.message);
      }
      console.error(
        "ErvisioTodo plugin request failed:",
        e instanceof Error ? e.name : "Error",
      );
      return problem(500, "Internal Server Error", "Request failed");
    }
  };
}

export const methodNotAllowed = pluginRoute(async () =>
  problem(405, "Method Not Allowed", "Method not allowed"),
);
