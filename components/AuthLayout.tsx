import { ShellBackdrop } from "@/components/shell/ShellBackdrop";
import { workspaceSettings } from "@/lib/server/settings";

/** Sign-in pages: the glass backdrop, the wordmark at the top and the form filling the rest. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const name = workspaceSettings().siteName;
  return (
    <div className="auth-page">
      <ShellBackdrop />
      <a href="/" className="auth-mark">
        <i>{name.slice(0, 1).toUpperCase()}</i>
        {name}
      </a>
      {children}
    </div>
  );
}
