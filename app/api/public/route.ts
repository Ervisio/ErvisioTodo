import { publicConfig } from "@/lib/server/config";
import { success } from "@/lib/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return success(publicConfig());
}
