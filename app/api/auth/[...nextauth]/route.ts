import { handlers } from "@/lib/auth";
import { availableProviders } from "@/lib/server/config";
import type { NextRequest } from "next/server";
import { allowedHost } from "@/lib/server/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: NextRequest) {
  const hostname = (
    request.headers.get("host") || new URL(request.url).host
  ).split(":")[0];
  if (!allowedHost(hostname))
    return Response.json(
      { success: false, error: "Host non consentito" },
      { status: 403 },
    );
  const path = new URL(request.url).pathname.split("/");
  const provider = path[4];
  if (
    provider &&
    ["signin", "callback"].includes(path[3]) &&
    !availableProviders()[
      provider as keyof ReturnType<typeof availableProviders>
    ]
  )
    return Response.json(
      { success: false, error: "Metodo di accesso disabilitato" },
      { status: 403 },
    );
  return request.method === "GET"
    ? handlers.GET(request)
    : handlers.POST(request);
}
export { handle as GET, handle as POST };
