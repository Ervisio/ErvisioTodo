import { auth } from "@/lib/auth";
import { api } from "@/lib/server/http";
import { actorFromToken } from "@/lib/server/tokens";
import { actorContext } from "@/lib/server/api-policy";
import { fileFor } from "@/lib/server/files";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const tokenUser = actorFromToken(request);
    const session = tokenUser ? null : await auth(),
      { id } = await context.params;
    const file = tokenUser
      ? actorContext.run(tokenUser, () => fileFor(id, tokenUser.id))
      : fileFor(id, session?.user.id);
    return new Response(file.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `${file.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
