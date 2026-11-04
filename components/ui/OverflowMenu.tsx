"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { faEllipsis } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type MenuItem = {
  label: string;
  icon: IconDefinition;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};
export type MenuGroup = { label: string; items: MenuItem[] };

export function OverflowMenu({
  label,
  groups,
}: {
  label: string;
  groups: MenuGroup[];
}) {
  const [open, setOpen] = useState(false),
    wrapper = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    id = useId();
  const items = () =>
    Array.from(
      wrapper.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) button.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) return;
    const all = items(),
      index = all.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") close();
    else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      all[event.key === "Home" ? 0 : all.length - 1]?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      all[(index + step + all.length) % all.length]?.focus();
    }
  }
  return (
    <div className="overflow-wrap" ref={wrapper} onKeyDown={onKeyDown}>
      <button
        ref={button}
        className="icon-button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp"))
            return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <Icon icon={faEllipsis} />
      </button>
      {open && (
        <div id={id} className="overflow-menu" role="menu" aria-label={label}>
          {groups.map((group, groupIndex) => (
            <div
              role={groups.length > 1 ? "group" : "none"}
              aria-labelledby={
                groups.length > 1 ? `${id}-group-${groupIndex}` : undefined
              }
              key={group.label}
            >
              {groups.length > 1 && (
                <p
                  className="menu-label"
                  id={`${id}-group-${groupIndex}`}
                  role="presentation"
                >
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  tabIndex={-1}
                  className={item.danger ? "danger-icon" : undefined}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    close();
                    item.onSelect();
                  }}
                >
                  <Icon icon={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
