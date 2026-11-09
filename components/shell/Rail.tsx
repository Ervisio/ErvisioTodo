"use client";
import Link from "next/link";
import useSWR from "swr";
import { signOut } from "next-auth/react";
import type { CSSProperties, ReactNode } from "react";
import {
  faCode,
  faGear,
  faLayerGroup,
  faPlus,
  faRightFromBracket,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/Icon";
import { ListIcon } from "@/components/ui/ListIcon";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { usePreferences } from "@/components/Preferences";
import { dataFetcher } from "@/lib/client";
import type { TodoProjectPlain } from "@/types/todo";

/** Which rail item is current: the overview, one project, standalone lists or the settings area. */
export type RailActive =
  | { kind: "overview" }
  | { kind: "project"; id: string }
  | { kind: "unassigned" }
  | { kind: "settings" }
  | null;

export function projectGlyph(project: TodoProjectPlain) {
  return (
    <ListIcon
      list={{
        iconType: project.iconValue.startsWith("fa-") ? "fontawesome" : "emoji",
        iconValue: project.iconValue,
      }}
    />
  );
}

/**
 * Borderless project rail shared by the workspace and the settings pages. Inside the workspace the
 * handlers switch views in place; elsewhere every item is a plain link back to the workspace.
 */
export function Rail({
  userName,
  active,
  settingsTip,
  onOverview,
  onProject,
  onUnassigned,
  onNewProject,
}: {
  userName: string;
  active: RailActive;
  settingsTip?: string;
  onOverview?: () => void;
  onProject?: (project: TodoProjectPlain) => void;
  onUnassigned?: () => void;
  onNewProject?: () => void;
}) {
  const { t } = usePreferences(),
    { data: projects = [] } = useSWR<TodoProjectPlain[]>(
      "/api/admin/todo/projects",
      dataFetcher,
    ),
    { data: config } = useSWR("/api/public", dataFetcher);
  const item = (
    key: string,
    label: string,
    content: ReactNode,
    current: boolean,
    target: { onClick?: () => void; href: string },
    extra: { className?: string; style?: CSSProperties } = {},
  ) => {
    const props = {
      className: `rail-item${extra.className ? ` ${extra.className}` : ""}${current ? " active" : ""}`,
      "aria-label": label,
      "aria-current": current ? ("page" as const) : undefined,
      "data-tip": label,
      "data-tip-side": "right",
      style: extra.style,
    };
    return target.onClick ? (
      <button key={key} {...props} onClick={target.onClick}>
        {content}
      </button>
    ) : (
      <Link key={key} href={target.href} {...props}>
        {content}
      </Link>
    );
  };
  return (
    <nav className="rail" aria-label={t("Progetti")}>
      {item(
        "overview",
        t("Panoramica"),
        config?.siteName && config.siteName !== "ErvisioTodo"
          ? config.siteName.slice(0, 1).toUpperCase()
          : "E",
        active?.kind === "overview",
        { onClick: onOverview, href: "/" },
        { className: "rail-logo" },
      )}
      <div className="rail-scroll">
        {projects.map((project, index) =>
          item(
            project._id,
            project.title,
            projectGlyph(project),
            active?.kind === "project" && active.id === project._id,
            {
              onClick: onProject && (() => onProject(project)),
              href: `/p/${project.slug}`,
            },
            {
              style: {
                "--c": project.color,
                "--n": index + 1,
              } as CSSProperties,
            },
          ),
        )}
        {onUnassigned &&
          item(
            "unassigned",
            t("Senza progetto"),
            <Icon icon={faLayerGroup} />,
            active?.kind === "unassigned",
            { onClick: onUnassigned, href: "/" },
            { style: { "--n": projects.length + 1 } as CSSProperties },
          )}
        {onNewProject &&
          item(
            "new",
            t("Nuovo progetto"),
            <Icon icon={faPlus} />,
            false,
            { onClick: onNewProject, href: "/" },
            {
              className: "rail-ghost",
              style: { "--n": projects.length + 2 } as CSSProperties,
            },
          )}
      </div>
      <span className="rail-spacer" />
      <Link
        href="/settings"
        className={`rail-item rail-ghost${active?.kind === "settings" ? " active" : ""}`}
        aria-label={t("Impostazioni")}
        aria-current={active?.kind === "settings" ? "page" : undefined}
        data-tip={settingsTip || t("Impostazioni")}
        data-tip-side="right"
      >
        <Icon icon={faGear} />
      </Link>
      <OverflowMenu
        label={t("Il tuo account")}
        className="rail-item rail-avatar"
        placement="right-end"
        tipSide="right"
        trigger={<span>{(userName || "?").slice(0, 2).toUpperCase()}</span>}
        groups={[
          {
            label: userName || t("Account"),
            items: [
              {
                label: t("Il tuo account"),
                icon: faUser,
                onSelect: () => location.assign("/account"),
              },
              {
                label: t("Documentazione API"),
                icon: faCode,
                onSelect: () => location.assign("/api-docs"),
              },
              {
                label: t("Esci"),
                icon: faRightFromBracket,
                danger: true,
                onSelect: () => signOut({ callbackUrl: "/login" }),
              },
            ],
          },
        ]}
      />
    </nav>
  );
}
