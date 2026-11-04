import {
  json,
  methodNotAllowed,
  pluginBody,
  pluginRoute,
  problem,
} from "@/lib/server/plugin-api";
import { pluginSettings } from "@/lib/server/plugin-data";
import { recordActivity, saveSettings } from "@/lib/server/settings";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = pluginRoute(async () => json(pluginSettings()));
export const PUT = pluginRoute(async (request) => {
  const body = await pluginBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return problem(422, "Validation failed", "Expected an object", [
      { path: "", msg: "Expected { values: {...} }" },
    ]);
  const { values } = body as { values?: unknown };
  if (!values || typeof values !== "object" || Array.isArray(values))
    return problem(422, "Validation failed", "Missing values", [
      { path: "values", msg: "Expected an object" },
    ]);
  saveSettings(values);
  recordActivity(null, "settings.update", "ervisio-plugin");
  return json(pluginSettings());
});
export {
  methodNotAllowed as POST,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
};
