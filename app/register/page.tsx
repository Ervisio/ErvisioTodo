import { AuthForm } from "@/components/AuthForm";
import { AuthLayout } from "@/components/AuthLayout";
import { publicConfig, canonicalUrl } from "@/lib/server/config";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Register() {
  if ((await headers()).get("host") !== new URL(canonicalUrl()).host)
    redirect(`${canonicalUrl()}/register`);
  return (
    <AuthLayout>
      <AuthForm config={publicConfig()} mode="register" />
    </AuthLayout>
  );
}
