import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { availableProviders, authSettings, flag, canonicalUrl } from "./config";
import { byLogin, registerUser, passwordSchema, type DbUser } from "./users";
import { createToken } from "./tokens";
import { consumeToken, sendAccountToken } from "./mail";
import { insist, rateLimit, clientAddress } from "./security";
import { managedUser } from "./admin-users";
export async function apiSignIn(input: unknown, request: Request) {
  insist(
    availableProviders().credentials,
    403,
    "Accesso con password disabilitato",
  );
  const data = z
    .object({
      login: z.string().trim().min(1).max(254),
      password: z.string().min(1).max(72),
      name: z.string().max(80).default("API login"),
      lifetimeDays: z.number().int().min(1).optional(),
    })
    .strict()
    .parse(input);
  rateLimit(`api-login:${data.login.toLowerCase()}`, 12);
  rateLimit(`api-login-ip:${clientAddress(request)}`, 60);
  const user = byLogin(data.login),
    valid = await bcrypt.compare(
      data.password,
      user?.password ||
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
  insist(
    valid &&
      user?.password &&
      user.is_active &&
      (!flag("REQUIRE_EMAIL_VERIFICATION", false) || user.verified),
    401,
    "Credenziali non valide o account non disponibile",
  );
  return {
    ...createToken(
      {
        name: data.name,
        scopes: ["read", "write"],
        ...(data.lifetimeDays ? { lifetimeDays: data.lifetimeDays } : {}),
      },
      user,
    ),
    user: managedUser(user),
  };
}
export async function apiAccountAction(
  action: string,
  input: unknown,
  request: Request,
) {
  rateLimit(
    `api-account:${action}:${clientAddress(request)}`,
    action === "register" ? 10 : 30,
  );
  if (action === "register") {
    insist(
      authSettings().registration && availableProviders().credentials,
      403,
      "Registrazione con password disabilitata",
    );
    const user = await registerUser(input);
    if (flag("REQUIRE_EMAIL_VERIFICATION", false))
      await sendAccountToken(user.id, user.email, "verify");
    return {
      user: managedUser(user),
      verificationRequired: flag("REQUIRE_EMAIL_VERIFICATION", false),
    };
  }
  if (action === "forgot") {
    const data = z
      .object({ email: z.email().max(254) })
      .strict()
      .parse(input);
    rateLimit(`email:forgot:${data.email.toLowerCase()}`, 3);
    const user = byLogin(data.email);
    if (user?.is_active && user.password && process.env.SMTP_URL) {
      try {
        await sendAccountToken(user.id, user.email, "reset");
      } catch {}
    }
    return {
      message: "Se l’indirizzo è registrato, riceverai un link di recupero.",
    };
  }
  if (action === "reset") {
    insist(
      availableProviders().credentials,
      403,
      "Accesso con password disabilitato",
    );
    const data = z
        .object({
          token: z.string().min(32).max(128),
          password: passwordSchema,
        })
        .strict()
        .parse(input),
      hash = await bcrypt.hash(data.password, 12);
    consumeToken(data.token, "reset", (id) => {
      db()
        .prepare(
          "UPDATE users SET password=?,session_version=session_version+1 WHERE id=? AND is_active=1",
        )
        .run(hash, id);
      db().prepare("DELETE FROM api_tokens WHERE owner=?").run(id);
      db().prepare("DELETE FROM tokens WHERE user_id=?").run(id);
    });
    return {
      message:
        "Password aggiornata. Le sessioni e i token precedenti sono stati revocati.",
    };
  }
  const data = z
    .object({ token: z.string().min(32).max(128) })
    .strict()
    .parse(input);
  consumeToken(data.token, "verify", (id) => {
    db()
      .prepare("UPDATE users SET verified=1 WHERE id=? AND is_active=1")
      .run(id);
  });
  return { message: "Email confermata." };
}
export async function changePassword(input: unknown, user: DbUser) {
  insist(
    availableProviders().credentials,
    403,
    "Accesso con password disabilitato",
  );
  const data = z
    .object({ currentPassword: z.string().max(72), password: passwordSchema })
    .strict()
    .parse(input);
  insist(
    user.password &&
      (await bcrypt.compare(data.currentPassword, user.password)),
    400,
    "Password attuale non corretta",
  );
  const hash = await bcrypt.hash(data.password, 12);
  db()
    .prepare(
      "UPDATE users SET password=?,session_version=session_version+1 WHERE id=?",
    )
    .run(hash, user.id);
  db().prepare("DELETE FROM api_tokens WHERE owner=?").run(user.id);
  db().prepare("DELETE FROM tokens WHERE user_id=?").run(user.id);
  return { message: "Password aggiornata. Accedi di nuovo." };
}
