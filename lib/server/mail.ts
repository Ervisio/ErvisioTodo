import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { db, transaction } from "./db";
import { canonicalUrl } from "./config";
import { digest, insist } from "./security";
export async function sendAccountToken(
  userId: string,
  email: string,
  kind: "reset" | "verify",
) {
  insist(process.env.SMTP_URL, 503, "Invio email non configurato");
  const token = randomBytes(32).toString("base64url");
  transaction(() => {
    db()
      .prepare("DELETE FROM tokens WHERE user_id=? AND kind=?")
      .run(userId, kind);
    db()
      .prepare("INSERT INTO tokens(hash,user_id,kind,expires) VALUES(?,?,?,?)")
      .run(digest(token), userId, kind, Date.now() + 30 * 60_000);
  });
  const url = `${canonicalUrl()}/login?${kind}=${token}`;
  const transport = nodemailer.createTransport(process.env.SMTP_URL!);
  await transport.sendMail({
    from: process.env.MAIL_FROM || "ErvisioTodo <noreply@example.com>",
    to: email,
    subject:
      kind === "reset"
        ? "Reimposta la password di ErvisioTodo"
        : "Conferma il tuo indirizzo email",
    text: `Apri questo link entro 30 minuti:\n${url}\n\nSe non hai richiesto questa operazione, ignora il messaggio.`,
  });
}
export function consumeToken(
  token: string,
  kind: string,
  action: (userId: string) => void,
) {
  return transaction(() => {
    const row = db()
      .prepare("SELECT user_id,expires FROM tokens WHERE hash=? AND kind=?")
      .get(digest(token), kind) as
      { user_id: string; expires: number } | undefined;
    insist(row && row.expires > Date.now(), 400, "Link scaduto o non valido");
    action(row.user_id);
    db().prepare("DELETE FROM tokens WHERE hash=?").run(digest(token));
  });
}
