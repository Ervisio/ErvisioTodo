import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, transaction } from "./db";
import { insist } from "./security";
export type DbUser = {
  id: string;
  username: string;
  email: string;
  password: string | null;
  role: string;
  session_version: number;
  verified: number;
  created_at: string;
  is_active: number;
};
export const passwordSchema = z
  .string()
  .min(12, "Usa almeno 12 caratteri")
  .max(72)
  .refine(
    (p) => Buffer.byteLength(p, "utf8") <= 72,
    "Password troppo lunga (max 72 byte)",
  );
export const registrationSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Usa lettere, numeri, _ e -"),
  email: z
    .email()
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  password: passwordSchema,
});
export function byId(id: string) {
  return db().prepare("SELECT * FROM users WHERE id=?").get(id) as
    DbUser | undefined;
}
export function byLogin(value: string) {
  return db()
    .prepare(
      "SELECT * FROM users WHERE email=? COLLATE NOCASE OR username=? COLLATE NOCASE",
    )
    .get(value, value) as DbUser | undefined;
}
export function publicUser(u: DbUser) {
  return { _id: u.id, username: u.username, name: u.username };
}
function insertUser(
  username: string,
  email: string,
  password: string | null,
  verified = false,
) {
  insist(
    !byLogin(email) && !byLogin(username),
    409,
    "Username o email già utilizzati. Accedi o collega il provider dal tuo account.",
  );
  const first = !db().prepare("SELECT 1 FROM users LIMIT 1").get();
  const id = randomUUID();
  db()
    .prepare(
      "INSERT INTO users(id,username,email,password,role,verified,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .run(
      id,
      username,
      email,
      password,
      first ? "admin" : "user",
      verified ? 1 : 0,
      new Date().toISOString(),
    );
  return byId(id)!;
}
export function createUser(
  username: string,
  email: string,
  password: string | null,
  verified = false,
) {
  return transaction(() => insertUser(username, email, password, verified));
}
export async function registerUser(input: unknown) {
  const data = registrationSchema.parse(input);
  const hash = await bcrypt.hash(data.password, 12);
  return createUser(data.username, data.email, hash);
}
export function oauthUser(
  provider: string,
  subject: string,
  email: string | null | undefined,
  name: string | null | undefined,
  registration: boolean,
  linkUser?: string,
) {
  const account = db()
    .prepare("SELECT user_id FROM accounts WHERE provider=? AND subject=?")
    .get(provider, subject) as { user_id: string } | undefined;
  if (account) {
    insist(
      !linkUser || account.user_id === linkUser,
      409,
      "Questo provider è già collegato a un altro account",
    );
    const user = byId(account.user_id)!;
    insist(user?.is_active, 403, "Account disabilitato");
    return user;
  }
  if (linkUser) {
    const user = byId(linkUser);
    insist(user?.is_active, 401, "Account non valido");
    db()
      .prepare("INSERT INTO accounts(provider,subject,user_id) VALUES(?,?,?)")
      .run(provider, subject, user.id);
    return user;
  }
  insist(registration, 403, "Registrazione disabilitata");
  insist(
    email && z.email().safeParse(email).success,
    400,
    "Il provider non ha fornito un indirizzo email valido",
  );
  const normalized = email.toLowerCase();
  insist(
    !byLogin(normalized),
    409,
    "Email già registrata. Collega questo provider dalla pagina Account dopo avere effettuato l’accesso.",
  );
  const base =
    (name || normalized.split("@")[0])
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 22) || "utente";
  const username = `${base}_${randomUUID().slice(0, 8)}`;
  return transaction(() => {
    const user = insertUser(username, normalized, null, true);
    db()
      .prepare("INSERT INTO accounts(provider,subject,user_id) VALUES(?,?,?)")
      .run(provider, subject, user.id);
    return user;
  });
}
