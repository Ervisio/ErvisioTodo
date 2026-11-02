import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { api, requireUser, success } from "@/lib/server/http";
import {
  assertOrigin,
  clientAddress,
  digest,
  insist,
  jsonBody,
  rateLimit,
} from "@/lib/server/security";
import {
  availableProviders,
  authSettings,
  canonicalUrl,
  flag,
} from "@/lib/server/config";
import { registerUser, byLogin, passwordSchema } from "@/lib/server/users";
import { db } from "@/lib/server/db";
import { consumeToken, sendAccountToken } from "@/lib/server/mail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  return api(async () => {
    assertOrigin(request);
    const { action } = await context.params,
      input = await jsonBody(request);
    rateLimit(
      `account:${action}:${clientAddress(request)}`,
      action === "register" ? 10 : 30,
    );
    if (action === "register") {
      insist(
        authSettings().registration && availableProviders().credentials,
        403,
        "Registrazione con password disabilitata",
      );
      const user = await registerUser(input);
      if (flag("REQUIRE_EMAIL_VERIFICATION", false)) {
        try {
          await sendAccountToken(user.id, user.email, "verify");
        } catch {
          return success(
            {
              message:
                "Account creato. Invio email non riuscito: usa Invia conferma nella pagina di accesso.",
              verificationRequired: true,
            },
            201,
          );
        }
      }
      return success(
        {
          message: flag("REQUIRE_EMAIL_VERIFICATION", false)
            ? "Account creato. Controlla la tua email per confermarlo."
            : "Account creato. Ora puoi accedere.",
          verificationRequired: flag("REQUIRE_EMAIL_VERIFICATION", false),
        },
        201,
      );
    }
    if (action === "forgot" || action === "resend") {
      const { email } = z.object({ email: z.email().max(254) }).parse(input);
      rateLimit(`email:${action}:${email.toLowerCase()}`, 3);
      const user = byLogin(email);
      if (
        process.env.SMTP_URL &&
        user &&
        (action === "forgot" ? !!user.password : !user.verified)
      ) {
        try {
          await sendAccountToken(
            user.id,
            user.email,
            action === "forgot" ? "reset" : "verify",
          );
        } catch {
          /* uniform response, no account enumeration */
        }
      }
      return success({
        message:
          "Se l’indirizzo è registrato e il servizio email è configurato, riceverai un link entro pochi minuti.",
      });
    }
    if (action === "reset") {
      insist(
        availableProviders().credentials,
        403,
        "Accesso con password disabilitato",
      );
      const { token, password } = z
        .object({
          token: z.string().min(32).max(128),
          password: passwordSchema,
        })
        .parse(input);
      const hash = await bcrypt.hash(password, 12);
      consumeToken(token, "reset", (userId) => {
        db()
          .prepare(
            "UPDATE users SET password=?,session_version=session_version+1 WHERE id=?",
          )
          .run(hash, userId);
        db().prepare("DELETE FROM tokens WHERE user_id=?").run(userId);
        db().prepare("DELETE FROM api_tokens WHERE owner=?").run(userId);
      });
      return success({ message: "Password aggiornata. Accedi di nuovo." });
    }
    if (action === "verify") {
      const { token } = z
        .object({ token: z.string().min(32).max(128) })
        .parse(input);
      consumeToken(token, "verify", (id) => {
        db().prepare("UPDATE users SET verified=1 WHERE id=?").run(id);
      });
      return success({ message: "Email confermata. Ora puoi accedere." });
    }
    const user = await requireUser();
    if (action === "password") {
      insist(
        availableProviders().credentials,
        403,
        "Accesso con password disabilitato",
      );
      const { currentPassword, password } = z
        .object({
          currentPassword: z.string().max(72),
          password: passwordSchema,
        })
        .parse(input);
      insist(
        user.password && (await bcrypt.compare(currentPassword, user.password)),
        400,
        "Password attuale non corretta",
      );
      const hash = await bcrypt.hash(password, 12);
      db()
        .prepare(
          "UPDATE users SET password=?,session_version=session_version+1 WHERE id=?",
        )
        .run(hash, user.id);
      db().prepare("DELETE FROM api_tokens WHERE owner=?").run(user.id);
      return success({ message: "Password aggiornata. Accedi di nuovo." });
    }
    if (action === "link") {
      const { provider } = z
        .object({ provider: z.enum(["google", "discord", "cognito"]) })
        .parse(input);
      insist(availableProviders()[provider], 400, "Provider non disponibile");
      const token = randomBytes(32).toString("base64url");
      db()
        .prepare("DELETE FROM tokens WHERE user_id=? AND kind=?")
        .run(user.id, `link:${provider}`);
      db()
        .prepare(
          "INSERT INTO tokens(hash,user_id,kind,expires) VALUES(?,?,?,?)",
        )
        .run(
          digest(token),
          user.id,
          `link:${provider}`,
          Date.now() + 10 * 60_000,
        );
      const response = NextResponse.json({ success: true });
      response.cookies.set("ervisio.link", token, {
        httpOnly: true,
        secure: canonicalUrl().startsWith("https:"),
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return response;
    }
    insist(false, 404, "Endpoint non trovato");
  });
}
