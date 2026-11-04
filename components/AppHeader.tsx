"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import useSWR from "swr";
import { Icon } from "@/components/ui/Icon";
import {
  faCheck,
  faGear,
  faRightFromBracket,
  faBars,
  faCode,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { usePreferences } from "./Preferences";
import { dataFetcher } from "@/lib/client";
export function AppHeader({ name }: { name: string; role: string }) {
  const { t } = usePreferences(),
    { data } = useSWR("/api/public", dataFetcher);
  return (
    <header className="app-header">
      <button
        className="mobile-menu-button"
        aria-label={t("Apri menu")}
        onClick={() => window.dispatchEvent(new Event("ervisio:menu"))}
      >
        <Icon icon={faBars} />
      </button>
      <Link href="/" className="wordmark">
        <span className="brand-symbol">
          <Icon icon={faCheck} />
        </span>
        <span>
          {data?.siteName && data.siteName !== "ErvisioTodo" ? (
            data.siteName
          ) : (
            <>
              <b>ervisio</b>
              <small>Todo</small>
            </>
          )}
        </span>
      </Link>
      <nav aria-label={t("Account")}>
        <Link
          href="/"
          className="header-project-link"
          aria-label={t("Progetti")}
          title={t("Progetti")}
        >
          <Icon icon={faFolderOpen} />
        </Link>
        <Link href="/api-docs" title="API" aria-label="Documentazione API">
          <Icon icon={faCode} />
        </Link>
        <Link
          href="/settings"
          className="header-settings-link"
          aria-label={t("Impostazioni")}
          title={t("Impostazioni")}
        >
          <Icon icon={faGear} />
        </Link>
        <Link
          href="/account"
          className="user-link"
          aria-label={t("Il tuo account")}
          title={name}
        >
          <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label={t("Esci")}
          title={t("Esci")}
        >
          <Icon icon={faRightFromBracket} />
        </button>
      </nav>
    </header>
  );
}
