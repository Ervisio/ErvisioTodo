import NextAuth, { AuthError } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import Cognito from "next-auth/providers/cognito";
import type { Provider } from "next-auth/providers";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import {
  assertConfig,
  authSettings,
  availableProviders,
  flag,
  canonicalUrl,
} from "./server/config";
import { byId, byLogin, oauthUser } from "./server/users";
import {
  clientAddress,
  rateLimit,
  safeReturnTo,
  digest,
} from "./server/security";
import { db } from "./server/db";
assertConfig();
const secure = new URL(canonicalUrl()).protocol === "https:";
const providers: Provider[] = [
  Credentials({
    credentials: { login: {}, password: {} },
    async authorize(credentials, request) {
      if (!availableProviders().credentials) return null;
      const login = String(credentials.login || "")
          .trim()
          .toLowerCase(),
        password = String(credentials.password || "");
      if (
        !login ||
        login.length > 254 ||
        password.length < 1 ||
        Buffer.byteLength(password) > 72
      )
        return null;
      rateLimit(`login:identity:${login}`, 12);
      rateLimit(`login:ip:${clientAddress(request)}`, 60);
      const user = byLogin(login);
      const hash =
        user?.password ||
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
      const valid = await bcrypt.compare(password, hash);
      if (
        !valid ||
        !user?.password ||
        !user.is_active ||
        (flag("REQUIRE_EMAIL_VERIFICATION", false) && !user.verified)
      )
        return null;
      return {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
        sessionVersion: user.session_version,
      };
    },
  }),
];
// Register only configured providers; runtime switches are checked at both start and callback.
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      checks: ["pkce", "state", "nonce"],
    }),
  );
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET)
  providers.push(
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      authorization: { params: { scope: "identify email" } },
      checks: ["pkce", "state"],
    }),
  );
if (
  process.env.AUTH_COGNITO_ID &&
  process.env.AUTH_COGNITO_SECRET &&
  process.env.AUTH_COGNITO_ISSUER
)
  providers.push(
    Cognito({
      clientId: process.env.AUTH_COGNITO_ID,
      clientSecret: process.env.AUTH_COGNITO_SECRET,
      issuer: process.env.AUTH_COGNITO_ISSUER,
      checks: ["pkce", "state", "nonce"],
    }),
  );
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login", error: "/login" },
  logger: {
    error(error) {
      const type = error instanceof AuthError ? error.type : error.name;
      if (type !== "CredentialsSignin")
        console.error("ErvisioTodo auth:", type);
    },
  },
  cookies: {
    sessionToken: {
      name: `${secure ? "__Secure-" : ""}ervisio.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        ...(process.env.AUTH_COOKIE_DOMAIN
          ? { domain: process.env.AUTH_COOKIE_DOMAIN }
          : {}),
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (
        !account ||
        !availableProviders()[
          account.provider as keyof ReturnType<typeof availableProviders>
        ]
      )
        return false;
      if (account.provider !== "credentials") {
        try {
          // Never infer account ownership from a matching email. Linking requires an explicit, short-lived intent.
          const token = (await cookies()).get("ervisio.link")?.value;
          const intent = token
            ? (db()
                .prepare(
                  "SELECT user_id,expires FROM tokens WHERE hash=? AND kind=?",
                )
                .get(digest(token), `link:${account.provider}`) as
                { user_id: string; expires: number } | undefined)
            : undefined;
          const linkUser =
            intent && intent.expires > Date.now() ? intent.user_id : undefined;
          const claimedVerified = profile as
            { email_verified?: boolean; verified?: boolean } | undefined;
          if (
            !linkUser &&
            claimedVerified &&
            (claimedVerified.email_verified === false ||
              claimedVerified.verified === false)
          )
            return false;
          const stored = oauthUser(
            account.provider,
            account.providerAccountId,
            user.email,
            user.name,
            authSettings().registration,
            linkUser,
          );
          if (linkUser && token)
            db().prepare("DELETE FROM tokens WHERE hash=?").run(digest(token));
          user.id = stored.id;
          user.role = stored.role;
          user.name = stored.username;
          user.sessionVersion = stored.session_version;
        } catch {
          return "/login?error=AccountLinkRequired";
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.version = user.sessionVersion;
        token.role = user.role;
      }
      const current = token.sub ? byId(token.sub) : undefined;
      if (
        !current ||
        !current.is_active ||
        current.session_version !== token.version
      )
        return null;
      token.role = current.role;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = String(token.role || "user");
      return session;
    },
    redirect({ url }) {
      return safeReturnTo(url);
    },
  },
});
