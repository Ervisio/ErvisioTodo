import { api, success } from "@/lib/server/http";
import { sharedList } from "@/lib/server/shares";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return api(async () => success(sharedList((await context.params).token)));
}
