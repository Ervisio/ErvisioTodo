import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { byId } from "./users";
import { HttpError, insist } from "./security";
import { actorFromToken, type Actor } from "./tokens";
export async function requireUser(request?: Request): Promise<Actor> {
  const tokenUser = request ? actorFromToken(request) : undefined;
  if (tokenUser) return tokenUser;
  const session = await auth();
  const user = session?.user.id ? byId(session.user.id) : undefined;
  insist(user?.is_active, 401, "Accedi per continuare");
  return user;
}
export const success = (data: unknown = null, status = 200) =>
  Response.json(
    { success: true, data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function api(fn: () => Promise<Response> | Response) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ZodError)
      return Response.json(
        {
          success: false,
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    if (e instanceof HttpError)
      return Response.json(
        { success: false, error: e.message },
        {
          status: e.status,
          headers: e.status === 429 ? { "Retry-After": "900" } : undefined,
        },
      );
    console.error(
      "ErvisioTodo request failed:",
      e instanceof Error ? e.name : "Error",
    );
    return Response.json(
      { success: false, error: "Errore interno del servizio" },
      { status: 500 },
    );
  }
}
