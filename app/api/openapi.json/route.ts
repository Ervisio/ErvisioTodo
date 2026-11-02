import spec from "@/docs/openapi.json";
import { canonicalUrl } from "@/lib/server/config";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    { ...spec, servers: [{ url: canonicalUrl() }] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
