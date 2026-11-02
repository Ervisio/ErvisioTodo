import { allowedHost } from "@/lib/server/security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain") || "";
  const allowed = /^[a-z0-9.-]{1,253}$/.test(domain) && allowedHost(domain);
  return new Response(allowed ? "allowed" : "denied", {
    status: allowed ? 200 : 403,
  });
}
