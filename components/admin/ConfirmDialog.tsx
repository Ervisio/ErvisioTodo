"use client";
import { AdminModal } from "./AdminModal";
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  dangerous = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AdminModal open={open} title={title} onClose={onCancel} size="md">
      <p className="text-sm text-white/65">{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} className="button secondary">
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`button ${dangerous ? "danger" : ""}`}
        >
          {confirmLabel}
        </button>
      </div>
    </AdminModal>
  );
}
