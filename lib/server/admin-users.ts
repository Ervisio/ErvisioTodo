import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, transaction } from "./db";
import {
  byId,
  byLogin,
  registerUser,
  registrationSchema,
  type DbUser,
} from "./users";
import { insist } from "./security";
import { recordActivity } from "./settings";
export function managedUser(user: DbUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    active: !!user.is_active,
    emailVerified: !!user.verified,
    createdAt: user.created_at,
  };
}
export function usersForAdmin() {
  return (
    db().prepare("SELECT * FROM users ORDER BY created_at").all() as DbUser[]
  ).map(managedUser);
}
export async function createManagedUser(input: unknown, actor: DbUser) {
  insist(actor.role === "admin", 403, "Solo amministratori");
  const data = registrationSchema
    .extend({ role: z.enum(["admin", "user"]).default("user") })
    .strict()
    .parse(input);
  const created = await registerUser(data);
  if (data.role !== "user")
    db()
      .prepare("UPDATE users SET role=? WHERE id=?")
      .run(data.role, created.id);
  recordActivity(actor.id, "user.create", created.id);
  return managedUser(byId(created.id)!);
}
export function changeManagedUser(id: string, input: unknown, actor: DbUser) {
  insist(actor.role === "admin", 403, "Solo amministratori");
  const current = byId(id);
  insist(current, 404, "Utente non trovato");
  const data = z
    .object({
      username: registrationSchema.shape.username.optional(),
      email: registrationSchema.shape.email.optional(),
      role: z.enum(["admin", "user"]).optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .parse(input);
  const next = {
    ...current,
    username: data.username ?? current.username,
    email: data.email ?? current.email,
    role: data.role ?? current.role,
    is_active:
      data.active === undefined ? current.is_active : data.active ? 1 : 0,
  };
  const byName = byLogin(next.username),
    byEmail = byLogin(next.email);
  insist(
    (!byName || byName.id === id) && (!byEmail || byEmail.id === id),
    409,
    "Username o email già utilizzati",
  );
  transaction(() => {
    if (
      current.role === "admin" &&
      current.is_active &&
      (next.role !== "admin" || !next.is_active)
    ) {
      const admins = (
        db()
          .prepare(
            "SELECT count(*) n FROM users WHERE role='admin' AND is_active=1",
          )
          .get() as { n: number }
      ).n;
      insist(admins > 1, 400, "Mantieni almeno un amministratore attivo");
    }
    db()
      .prepare(
        "UPDATE users SET username=?,email=?,role=?,is_active=?,session_version=session_version+1 WHERE id=?",
      )
      .run(next.username, next.email, next.role, next.is_active, id);
    db().prepare("DELETE FROM api_tokens WHERE owner=?").run(id);
    db().prepare("DELETE FROM tokens WHERE user_id=?").run(id);
  });
  recordActivity(actor.id, "user.update", id);
  return managedUser(byId(id)!);
}
