"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import useSWR from "swr";
import { Icon } from "@/components/ui/Icon";
import {
  faCheck,
  faMagnifyingGlass,
  faGear,
  faRightFromBracket,
  faBars,
  faCode,
} from "@fortawesome/free-solid-svg-icons";
import { usePreferences } from "./Preferences";
import { dataFetcher } from "@/lib/client";
export function AppHeader({ name, role }: { name: string; role: string }) {
  const { t } = usePreferences(),
    { data } = useSWR("/api/public", dataFetcher),
    path = usePathname(),
    workspace =
      path === "/" || path.startsWith("/l/") || path.startsWith("/p/");
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
      {workspace ? (
        <label className="header-search">
          <Icon icon={faMagnifyingGlass} />
          <input
            type="search"
            aria-label={t("Cerca nelle attività")}
            placeholder={t("Cerca nelle attività")}
            onChange={(e) =>
              window.dispatchEvent(
                new CustomEvent("ervisio:search", { detail: e.target.value }),
              )
            }
          />
        </label>
      ) : (
        <div className="header-spacer" />
      )}
      <nav aria-label={t("Account")}>
        <Link href="/" className="header-project-link">
          {t("Progetti")}
        </Link>
        <Link href="/api-docs" title="API" aria-label="Documentazione API">
          <Icon icon={faCode} />
        </Link>
        <Link
          href="/settings"
          className="header-settings-link"
          title={t("Impostazioni")}
        >
          <Icon icon={faGear} />
          <span>{t("Impostazioni")}</span>
        </Link>
        <Link
          href="/account"
          className="user-link"
          aria-label={t("Il tuo account")}
        >
          <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
          <span className="max-md:hidden">{name}</span>
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
