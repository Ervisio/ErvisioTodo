import { db } from "@/lib/server/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    db().prepare("SELECT 1").get();
    return Response.json({ status: "ok", service: "ErvisioTodo" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
