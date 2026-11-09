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
  /** Turns the item into a menuitemcheckbox with a switch. */
  checked?: boolean;
  /** Keyboard hint shown on the right, e.g. "Ctrl K". */
  hint?: string;
};
export type MenuGroup = { label: string; items: MenuItem[] };

export function OverflowMenu({
  label,
  groups,
  trigger,
  className = "icon-button",
  placement = "below-end",
  tipSide = "bottom",
}: {
  label: string;
  groups: MenuGroup[];
  /** Custom button content; defaults to the ellipsis icon. */
  trigger?: React.ReactNode;
  className?: string;
  /** below-end opens under the button aligned right; right-end opens beside it, growing upwards. */
  placement?: "below-end" | "right-end";
  tipSide?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false),
    wrapper = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null),
    id = useId();
  const items = () =>
    Array.from(
      wrapper.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemcheckbox"]',
      ) ?? [],
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
        className={className}
        aria-label={label}
        data-tip={open ? undefined : label}
        data-tip-side={tipSide}
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
        {trigger ?? <Icon icon={faEllipsis} />}
      </button>
      {open && (
        <div
          id={id}
          className="overflow-menu"
          data-placement={placement}
          role="menu"
          aria-label={label}
        >
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
                  role={
                    item.checked === undefined ? "menuitem" : "menuitemcheckbox"
                  }
                  aria-checked={item.checked}
                  tabIndex={-1}
                  className={item.danger ? "danger-icon" : undefined}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    if (item.checked === undefined) close();
                    item.onSelect();
                  }}
                >
                  <Icon icon={item.icon} />
                  <span className="menu-text">{item.label}</span>
                  {item.hint && <kbd>{item.hint}</kbd>}
                  {item.checked !== undefined && (
                    <span className="menu-switch" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
