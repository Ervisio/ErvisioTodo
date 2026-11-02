import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { byId } from "./users";
import { canonicalUrl } from "./config";
import { allowedHost } from "./security";
export async function pageUser(path = "/") {
  const host = (await headers()).get("host") || new URL(canonicalUrl()).host;
  if (!allowedHost(host.split(":")[0])) notFound();
  const session = await auth(),
    user = session?.user.id ? byId(session.user.id) : undefined;
  if (!user?.is_active)
    redirect(
      `${canonicalUrl()}/login?returnTo=${encodeURIComponent(`${new URL(canonicalUrl()).protocol}//${host}${path}`)}`,
    );
  return user;
}
