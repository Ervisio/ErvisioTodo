"use client";
import { Icon } from "@/components/ui/Icon";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useId } from "react";
export function AdminModal({
  open,
  title,
  onClose,
  children,
  size = "lg",
  presentation = "dialog",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
  presentation?: "dialog" | "panel";
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) el.showModal();
    else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      className={`modal-surface ${presentation === "panel" ? "modal-panel" : ""} ${size === "md" ? "max-w-lg" : size === "xl" ? "max-w-4xl" : "max-w-2xl"}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="px-2 py-1 text-ink-dim"
        >
          <Icon icon={faXmark} />
        </button>
      </div>
      {open && <div className="p-6">{children}</div>}
    </dialog>
  );
}
