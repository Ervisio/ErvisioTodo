import { json, methodNotAllowed, pluginRoute } from "@/lib/server/plugin-api";
import { pluginStatus } from "@/lib/server/plugin-data";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = pluginRoute(async () => json(pluginStatus()));
export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
};
