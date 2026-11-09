"use client";
import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
export function AccountForm({
  providers,
  connected,
  hasPassword,
  email,
  username,
}: {
  providers: Record<string, boolean>;
  connected: string[];
  hasPassword: boolean;
  email: string;
  username: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function link(provider: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/account/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await signIn(provider, { redirectTo: "/account" });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function password(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const r = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await signOut({ callbackUrl: "/login" });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <section className="settings-section account-profile">
        <span className="account-avatar" aria-hidden="true">
          {username.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h2>{username}</h2>
          <p>{email}</p>
        </div>
      </section>
      <section className="settings-section">
        <h2>Account collegati</h2>
        {Object.entries({
          google: "Google",
          discord: "Discord",
          cognito: "AWS Cognito",
        }).map(([id, name]) => (
          <div key={id} className="settings-row">
            <span
              className="provider-badge"
              data-provider={id}
              aria-hidden="true"
            >
              {name.slice(0, 1)}
            </span>
            <div className="account-provider">
              <strong>{name}</strong>
              <p>
                {connected.includes(id)
                  ? "Collegato al tuo account"
                  : providers[id]
                    ? "Aggiungi un altro modo per accedere"
                    : "Non disponibile in questa installazione"}
              </p>
            </div>
            {providers[id] && !connected.includes(id) && (
              <button
                disabled={busy}
                onClick={() => link(id)}
                className="button secondary"
              >
                Collega
              </button>
            )}
          </div>
        ))}
      </section>
      {hasPassword && providers.credentials && (
        <section className="settings-section">
          <h2>Cambia password</h2>
          <form className="account-password" onSubmit={password}>
            <label className="field">
              Password attuale
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              Nuova password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                required
              />
            </label>
            <p className="settings-help">
              Almeno 12 caratteri. Il cambio password chiude le sessioni attive.
            </p>
            <button disabled={busy} className="button secondary">
              Aggiorna password
            </button>
          </form>
        </section>
      )}
      {error && (
        <p className="error mt-4" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
