"use client";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { faGoogle, faDiscord, faAws } from "@fortawesome/free-brands-svg-icons";
import { Icon } from "@/components/ui/Icon";

const providerIcons = {
  google: faGoogle,
  discord: faDiscord,
  cognito: faAws,
} as Record<string, typeof faGoogle>;
type Config = {
  providers: Record<string, boolean>;
  registration: boolean;
  passwordRecovery: boolean;
  emailVerification: boolean;
};
export function AuthForm({
  config,
  mode = "login",
  returnTo = "/",
  resetToken,
  verifyToken,
  initialError,
}: {
  config: Config;
  mode?: "login" | "register";
  returnTo?: string;
  resetToken?: string;
  verifyToken?: string;
  initialError?: string;
}) {
  const [view, setView] = useState(
      resetToken ? "reset" : verifyToken ? "verify" : mode,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(
      initialError
        ? "Accesso non riuscito. Se l’email è già registrata, accedi con il metodo abituale e collega il provider dalla pagina Account."
        : "",
    ),
    [notice, setNotice] = useState("");
  useEffect(() => {
    setView(resetToken ? "reset" : verifyToken ? "verify" : mode);
  }, [mode, resetToken, verifyToken]);
  const names: Record<string, string> = {
    google: "Google",
    discord: "Discord",
    cognito: "AWS Cognito",
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const fields = new FormData(e.currentTarget),
      data = Object.fromEntries(fields);
    try {
      if (view === "login") {
        const response = await signIn("credentials", {
          login: data.login,
          password: data.password,
          redirect: false,
          redirectTo: returnTo,
        });
        if (response?.error)
          throw new Error(
            "Credenziali non valide, account da confermare o troppi tentativi. Controlla i dati e riprova.",
          );
        window.location.assign(response?.url || returnTo);
      } else {
        const action =
          view === "register"
            ? "register"
            : view === "reset"
              ? "reset"
              : view === "verify"
                ? "verify"
                : view === "resend"
                  ? "resend"
                  : "forgot";
        const response = await fetch(`/api/account/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            ...(view === "reset"
              ? { token: resetToken }
              : view === "verify"
                ? { token: verifyToken }
                : {}),
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setNotice(body.data.message);
        if (["register", "reset", "verify"].includes(view)) {
          setView("login");
          window.history.replaceState(null, "", "/login");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita");
    } finally {
      setBusy(false);
    }
  }
  const isRegister = view === "register";
  const title =
    view === "reset"
      ? "Scegli una nuova password"
      : view === "verify"
        ? "Conferma la tua email"
        : view === "forgot"
          ? "Recupera l’accesso"
          : view === "resend"
            ? "Conferma il tuo account"
            : isRegister
              ? "Crea il tuo account"
              : "Bentornato";
  const providers = Object.entries(names).filter(
      ([key]) => config.providers[key],
    ),
    password =
      (config.providers.credentials && (!isRegister || config.registration)) ||
      !["login", "register"].includes(view),
    social = (view === "login" || isRegister) && providers.length > 0;
  return (
    <>
      <main className="auth-main">
        <div className="auth-form">
          <h1>{title}</h1>
          <p className="auth-intro">
            {isRegister
              ? "Un posto per organizzare attività, idee e progetti."
              : "Accedi alle tue liste e riprendi da dove eri rimasto."}
          </p>
          {password && (
            <form onSubmit={submit} className="auth-fields">
              {isRegister && (
                <label className="field">
                  Username
                  <input
                    name="username"
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-zA-Z0-9_-]+"
                    placeholder="Il tuo nome utente"
                  />
                </label>
              )}
              {!["reset", "verify"].includes(view) && (
                <label className="field">
                  {view === "login" ? "Username o email" : "Email"}
                  <input
                    name={view === "login" ? "login" : "email"}
                    type={view === "login" ? "text" : "email"}
                    autoComplete={view === "login" ? "username" : "email"}
                    required
                    placeholder={
                      view === "login"
                        ? "nome utente o email"
                        : "nome@esempio.it"
                    }
                  />
                </label>
              )}
              {!["forgot", "resend", "verify"].includes(view) && (
                <label className="field">
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={view === "login" ? 1 : 12}
                    maxLength={72}
                    autoComplete={
                      view === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      view === "login"
                        ? "La tua password"
                        : "Almeno 12 caratteri"
                    }
                  />
                </label>
              )}
              {view === "verify" && (
                <p className="auth-intro">
                  Premi il pulsante per confermare l’indirizzo email del tuo
                  account.
                </p>
              )}
              <button disabled={busy} className="button">
                {busy
                  ? "Attendi…"
                  : view === "login"
                    ? "Accedi"
                    : isRegister
                      ? "Crea account"
                      : view === "reset"
                        ? "Aggiorna password"
                        : view === "verify"
                          ? "Conferma email"
                          : "Invia link"}
              </button>
            </form>
          )}
          {social && (
            <>
              {password && <p className="auth-or">oppure</p>}
              <div className="provider-buttons">
                {providers.map(([key, name]) => (
                  <button
                    key={key}
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await signIn(key, { redirectTo: returnTo });
                    }}
                  >
                    <Icon icon={providerIcons[key]} />
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          {view === "login" &&
            !Object.values(config.providers).some(Boolean) && (
              <p className="error">
                Nessun metodo di accesso disponibile. Contatta il gestore.
              </p>
            )}
          {isRegister && !config.registration && (
            <p className="notice">Le nuove registrazioni sono chiuse.</p>
          )}
        </div>
      </main>
      <footer className="auth-foot">
        {view === "login" ? (
          <>
            <span>
              {config.passwordRecovery && config.providers.credentials && (
                <button onClick={() => setView("forgot")}>
                  Password dimenticata?
                </button>
              )}
              {config.emailVerification && (
                <button onClick={() => setView("resend")}>
                  Invia conferma email
                </button>
              )}
            </span>
            {config.registration && (
              <span>
                Non hai un account? <a href="/register">Registrati</a>
              </span>
            )}
          </>
        ) : (
          <button
            onClick={() => {
              setView("login");
              setError("");
            }}
          >
            Torna all’accesso
          </button>
        )}
      </footer>
    </>
  );
}
