"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  faArrowLeft,
  faCode,
  faDatabase,
  faPalette,
  faRightFromBracket,
  faServer,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Icon } from "@/components/ui/Icon";
import { usePreferences } from "@/components/Preferences";
import { Rail } from "./Rail";
import { ShellBackdrop } from "./ShellBackdrop";

/**
 * Settings, account, workspace and API docs share one glass sheet. It lives in the settings layout, so
 * moving between sections only swaps the content on the right; the rail and section column stay mounted.
 */
export function SettingsShell({
  userName,
  admin,
  children,
}: {
  userName: string;
  admin: boolean;
  children: React.ReactNode;
}) {
  const { t } = usePreferences(),
    path = usePathname();
  const link = (href: string, label: string, icon: IconDefinition) => {
    const active = path === href;
    return (
      <Link
        href={href}
        className={`settings-nav-item${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <Icon icon={icon} />
        <span>{label}</span>
      </Link>
    );
  };
  return (
    <main className="workspace glass-workspace">
      <div className="glass-shell settings-shell">
        <ShellBackdrop />
        <Rail userName={userName} active={{ kind: "settings" }} />
        <section className="slab settings-slab">
          <nav className="settings-nav" aria-label={t("Impostazioni")}>
            <Link href="/" className="settings-nav-item settings-back">
              <Icon icon={faArrowLeft} />
              <span>{t("Attività")}</span>
            </Link>
            <p className="settings-nav-group">{t("Tu")}</p>
            {link("/settings", t("Aspetto"), faPalette)}
            {link("/account", t("Account"), faUser)}
            {admin && (
              <>
                <p className="settings-nav-group">{t("Spazio di lavoro")}</p>
                {link("/settings/workspace", t("Generali e limiti"), faServer)}
                {link("/settings/storage", t("Archiviazione"), faDatabase)}
              </>
            )}
            <p className="settings-nav-group">{t("Sviluppatori")}</p>
            {link("/api-docs", t("Documentazione API"), faCode)}
            <hr className="settings-nav-sep" />
            <button
              type="button"
              className="settings-nav-item danger"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <Icon icon={faRightFromBracket} />
              <span>{t("Esci")}</span>
            </button>
          </nav>
          <div className="settings-content">{children}</div>
        </section>
      </div>
    </main>
  );
}

/** Title block at the top of a settings page; the optional hero turns it into a highlighted card. */
export function SettingsHead({
  title,
  description,
  hero,
  children,
}: {
  title: string;
  description?: string;
  hero?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = usePreferences();
  return (
    <div className="settings-inner">
      <header className={`settings-head${hero ? " hero" : ""}`}>
        <h1>{t(title)}</h1>
        {description && <p>{t(description)}</p>}
        {hero}
      </header>
      {children}
    </div>
  );
}
