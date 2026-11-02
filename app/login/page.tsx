import { AuthForm } from "@/components/AuthForm";
import { AuthLayout } from "@/components/AuthLayout";
import { publicConfig, canonicalUrl } from "@/lib/server/config";
import { safeReturnTo } from "@/lib/server/security";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams,
    host = (await headers()).get("host");
  if (host !== new URL(canonicalUrl()).host)
    redirect(
      `${canonicalUrl()}/login?returnTo=${encodeURIComponent(safeReturnTo(params.returnTo))}`,
    );
  return (
    <AuthLayout>
      <AuthForm
        config={publicConfig()}
        returnTo={safeReturnTo(params.returnTo)}
        resetToken={params.reset}
        verifyToken={params.verify}
        initialError={params.error}
      />
    </AuthLayout>
  );
}
