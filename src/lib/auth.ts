import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
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
  plugins: [nextCookies()],
});

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);
