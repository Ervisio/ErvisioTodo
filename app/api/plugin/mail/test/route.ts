import nodemailer from "nodemailer";
import { z } from "zod";
import {
  json,
  methodNotAllowed,
  pluginBody,
  pluginRoute,
  problem,
} from "@/lib/server/plugin-api";
import { canonicalUrl } from "@/lib/server/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = pluginRoute(async (request) => {
  const smtp = process.env.SMTP_URL;
  if (!smtp)
    return problem(422, "Mail not configured", "SMTP_URL is not set", [
      { path: "", msg: "SMTP_URL is not set" },
    ]);
  const body = await pluginBody(request),
    parsed = z
      .object({ to: z.email().max(254) })
      .safeParse(body && typeof body === "object" ? body : {});
  if (!parsed.success)
    return problem(422, "Validation failed", "Invalid recipient", [
      { path: "to", msg: "Enter a valid email address" },
    ]);
  try {
    await nodemailer.createTransport(smtp).sendMail({
      from: process.env.MAIL_FROM || "ErvisioTodo <noreply@example.com>",
      to: parsed.data.to,
      subject: "ErvisioTodo test email",
      text: `This is a test message from ${canonicalUrl()}. Mail delivery works.`,
    });
  } catch (e) {
    return problem(
      502,
      "Mail delivery failed",
      e instanceof Error ? e.message : "SMTP error",
    );
  }
  return json({ sent: true });
});
export {
  methodNotAllowed as GET,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
};
