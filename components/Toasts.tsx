"use client";
import { useEffect, useState } from "react";

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
interface ToastDetail {
  message: string;
  action?: ToastAction;
}

export function showToast(message: string, action?: ToastAction) {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>("ervisio:toast", {
      detail: { message, action },
    }),
  );
}

export function Toasts() {
  const [toast, setToast] = useState<(ToastDetail & { error: boolean }) | null>(
    null,
  );
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const open = (next: ToastDetail & { error: boolean }) => {
      setToast(next);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), next.error ? 7000 : 6000);
    };
    const showError = (e: Event) =>
      open({ message: (e as CustomEvent<string>).detail, error: true });
    const show = (e: Event) =>
      open({ ...(e as CustomEvent<ToastDetail>).detail, error: false });
    window.addEventListener("ervisio:error", showError);
    window.addEventListener("ervisio:toast", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("ervisio:error", showError);
      window.removeEventListener("ervisio:toast", show);
    };
  }, []);
  if (!toast) return null;
  return (
    <div
      role={toast.error ? "alert" : "status"}
      className={`toast${toast.error ? "" : " neutral"}`}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            void toast.action!.run();
            setToast(null);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={() => setToast(null)} aria-label="Chiudi messaggio">
        ✕
      </button>
    </div>
  );
}
