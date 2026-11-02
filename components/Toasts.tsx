"use client";
import { useEffect, useState } from "react";
export function Toasts() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (e: Event) => {
      setMessage((e as CustomEvent).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 7000);
    };
    window.addEventListener("ervisio:error", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("ervisio:error", show);
    };
  }, []);
  return message ? (
    <div role="alert" className="toast">
      <span>{message}</span>
      <button onClick={() => setMessage("")} aria-label="Chiudi messaggio">
        ✕
      </button>
    </div>
  ) : null;
}
