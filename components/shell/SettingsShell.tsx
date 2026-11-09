"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  faArrowLeft,
  faCode,
  faPalette,
  faRightFromBracket,
  faServer,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Icon } from "@/components/ui/Icon";
import { usePreferences } from "@/components/Preferences";
import { Rail, ShellBackdrop } from "./Rail";

export type SettingsSection = "appearance" | "account" | "workspace" | "api";

/**
 * Settings, account, workspace and API docs share one glass sheet: the project rail, a column of
 * sections grouped by audience, and the selected page. Each section keeps its own URL.
 */
export function SettingsShell({
  userName,
  admin,
  active,
  title,
  description,
  hero,
  children,
}: {
  userName: string;
  admin: boolean;
  active: SettingsSection;
  title: string;
  description?: string;
  /** Extra header content; turns the header into a highlighted hero card. */
  hero?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = usePreferences();
  const link = (
    key: SettingsSection,
    href: string,
    label: string,
    icon: IconDefinition,
  ) => (
    <Link
      href={href}
      className={`settings-nav-item${active === key ? " active" : ""}`}
      aria-current={active === key ? "page" : undefined}
    >
      <Icon icon={icon} />
      <span>{label}</span>
    </Link>
  );
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
            {link("appearance", "/settings", t("Aspetto"), faPalette)}
            {link("account", "/account", t("Account"), faUser)}
            {admin && (
              <>
                <p className="settings-nav-group">{t("Spazio di lavoro")}</p>
                {link(
                  "workspace",
                  "/settings/workspace",
                  t("Generali e limiti"),
                  faServer,
                )}
              </>
            )}
            <p className="settings-nav-group">{t("Sviluppatori")}</p>
            {link("api", "/api-docs", t("Documentazione API"), faCode)}
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
          <div className="settings-content">
            <div className="settings-inner" key={active}>
              <header className={`settings-head${hero ? " hero" : ""}`}>
                <h1>{t(title)}</h1>
                {description && <p>{t(description)}</p>}
                {hero}
              </header>
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
