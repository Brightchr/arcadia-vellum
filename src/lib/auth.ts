import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { banLoginMessage, getActiveBan } from "@/lib/bans";

// Turnstile guards email sign-in/sign-up when BOTH keys are set (the widget
// needs the public key, verification needs the secret). With either missing,
// auth works without a challenge — so a half-configured deploy can't lock
// everyone out.
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY ?? "";
const turnstileEnabled = Boolean(
  turnstileSecret && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "",
    "https://vellum-books.org",
  ].filter(Boolean),
  emailAndPassword: {
    enabled: true,
    // Applies to new passwords only; existing shorter ones still sign in.
    minPasswordLength: 12,
  },
  session: {
    // Session reads come from a signed cookie for up to 5 minutes instead of
    // hitting the DB on every request (page renders + all the polling).
    // Revocations and bans take up to that long to bite on cached requests.
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced: {
    // Sessions record the real client address (Cloudflare-fronted), which is
    // what IP bans are built from.
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Every sign-in (email or OAuth) creates a session — refusing here
        // blocks banned accounts on all routes in one place. Expired
        // suspensions clear themselves inside getActiveBan.
        before: async (session) => {
          const ban = await getActiveBan(session.userId);
          if (ban) {
            throw new APIError("FORBIDDEN", { message: banLoginMessage(ban) });
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      dashboardTheme: {
        type: "string",
        defaultValue: "witch-grimoire",
      },
      // Profile fields are read through the session but only writable via
      // /api/profile, which owns safety + uniqueness validation.
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
      avatarImageId: { type: "string", required: false, input: false },
      profileVisibility: {
        type: "string",
        defaultValue: "public",
        input: false,
      },
      allowFriendRequests: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
      showSavedOnProfile: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      // Moderation fields — read-only through the session; only the admin
      // API mutates them.
      role: { type: "string", defaultValue: "user", input: false },
      banned: { type: "boolean", defaultValue: false, input: false },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Offline access + consent prompt so Google returns a refresh token we
      // can use for background Drive syncs.
      accessType: "offline",
      prompt: "select_account consent",
    },
  },
  plugins: [
    ...(turnstileEnabled
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: turnstileSecret,
          }),
        ]
      : []),
    // Keep last — it must wrap the other plugins' cookie handling.
    nextCookies(),
  ],
});

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
