import { workspaceSettings } from "@/lib/server/settings";

/** Sign-in pages: the wordmark at the top and the form filling the rest, directly on the canvas. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const name = workspaceSettings().siteName;
  return (
    <div className="auth-page">
      <a href="/" className="auth-mark">
        <i>{name.slice(0, 1).toUpperCase()}</i>
        {name}
      </a>
      {children}
    </div>
  );
}
