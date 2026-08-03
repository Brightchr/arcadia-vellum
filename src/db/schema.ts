import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  customType,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (shape required by better-auth's drizzle adapter)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  dashboardTheme: text("dashboard_theme").notNull().default("witch-grimoire"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const series = pgTable("series", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const journals = pgTable("journals", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  seriesId: text("series_id").references(() => series.id, {
    onDelete: "set null",
  }),
  volumeNumber: integer("volume_number"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  author: text("author"),
  slug: text("slug").notNull().unique(),
  theme: text("theme").notNull().default("witch-grimoire"),
  sourceType: text("source_type", { enum: ["gdoc", "upload"] }).notNull(),
  gdocFileId: text("gdoc_file_id"),
  visibility: text("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const journalContent = pgTable("journal_content", {
  journalId: text("journal_id")
    .primaryKey()
    .references(() => journals.id, { onDelete: "cascade" }),
  html: text("html").notNull(),
  plainLength: integer("plain_length").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Owner-uploaded narration tracks (e.g. ElevenLabs renders), in play order. */
export const journalAudio = pgTable("journal_audio", {
  id: text("id").primaryKey(),
  journalId: text("journal_id")
    .notNull()
    .references(() => journals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortIndex: integer("sort_index").notNull().default(0),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const journalImages = pgTable("journal_images", {
  id: text("id").primaryKey(),
  journalId: text("journal_id")
    .notNull()
    .references(() => journals.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
