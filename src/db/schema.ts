import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  customType,
  primaryKey,
  unique,
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
  /** Public handle for /u/<username>; null until onboarding picks one. */
  username: text("username").unique(),
  bio: text("bio"),
  /** profile_images id for the uploaded avatar. */
  avatarImageId: text("avatar_image_id"),
  /** profile_images id for the profile banner (wide header art). */
  bannerImageId: text("banner_image_id"),
  profileVisibility: text("profile_visibility", {
    enum: ["public", "friends", "private"],
  })
    .notNull()
    .default("public"),
  allowFriendRequests: boolean("allow_friend_requests").notNull().default(true),
  showSavedOnProfile: boolean("show_saved_on_profile")
    .notNull()
    .default(false),
  /** Show shared (public/friends) playlists on the profile page. */
  showPlaylistsOnProfile: boolean("show_playlists_on_profile")
    .notNull()
    .default(false),
  /** Show follower/following/friend counts on the profile page. */
  showCountsOnProfile: boolean("show_counts_on_profile")
    .notNull()
    .default(true),
  /** Appear in user search (lookup by username or display name). */
  searchable: boolean("searchable").notNull().default(true),
  /** "admin" unlocks the admin dashboard and shows the profile badge. */
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  /** Banned users' works, reviews, and profile are hidden platform-wide. */
  banned: boolean("banned").notNull().default(false),
  bannedAt: timestamp("banned_at"),
  /** JSON array ordering the profile sections, e.g. ["bio","featured","works","saved"]. */
  profileLayout: text("profile_layout"),
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
  /** What the series is about — shown on its homepage. */
  description: text("description"),
  /** Sidebar icon (an emoji the owner picks, Spotify-playlist style). */
  icon: text("icon"),
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
  /** Optional chapter/part within the volume — displays as "Vol. 1.2". */
  partNumber: integer("part_number"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  /** What the work is about — shown on its homepage and access teasers. */
  description: text("description"),
  author: text("author"),
  slug: text("slug").notNull().unique(),
  theme: text("theme").notNull().default("witch-grimoire"),
  sourceType: text("source_type", {
    enum: ["gdoc", "upload", "audio", "write"],
  }).notNull(),
  gdocFileId: text("gdoc_file_id"),
  /** Optional cover art (journal_images id) — the listening page backdrop. */
  coverImageId: text("cover_image_id"),
  visibility: text("visibility", {
    enum: ["public", "friends", "restricted", "private"],
  })
    .notNull()
    .default("private"),
  /** Unchecked = unlisted: reachable by link but hidden from browse/search. */
  listed: boolean("listed").notNull().default(true),
  /** Featured works lead the owner's profile page. */
  featured: boolean("featured").notNull().default(false),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const journalContent = pgTable("journal_content", {
  journalId: text("journal_id")
    .primaryKey()
    .references(() => journals.id, { onDelete: "cascade" }),
  html: text("html").notNull(),
  /** Markdown source for journals written in the built-in editor. */
  sourceMd: text("source_md"),
  plainLength: integer("plain_length").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Owner-uploaded narration audio, in play order. Rows sharing a sortIndex
 * form one ENTRY (a single chapter in the player) whose files play
 * back-to-back in segmentIndex order.
 */
export const journalAudio = pgTable("journal_audio", {
  id: text("id").primaryKey(),
  journalId: text("journal_id")
    .notNull()
    .references(() => journals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortIndex: integer("sort_index").notNull().default(0),
  segmentIndex: integer("segment_index").notNull().default(0),
  /** Chapter image (journal_images id), stored on the entry's first segment. */
  coverImageId: text("cover_image_id"),
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

// ---------------------------------------------------------------------------
// Social platform tables
// ---------------------------------------------------------------------------

/** Uploaded profile avatars (small images, served via /api/avatars/<id>). */
export const profileImages = pgTable("profile_images", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** One-way follows (Spotify-style). */
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })]
);

/** Mutual friendships: a pending row is a request awaiting the addressee. */
export const friendships = pgTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.requesterId, t.addresseeId)]
);

/** Search tags (lowercase, safety-filtered on write). */
export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const journalTags = pgTable(
  "journal_tags",
  {
    journalId: text("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.journalId, t.tagId] })]
);

/**
 * Saved works — a user's personal shelf of other people's books and
 * audiobooks. kind: "journal" (standalone) | "series".
 */
export const savedItems = pgTable(
  "saved_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["journal", "series"] }).notNull(),
    itemId: text("item_id").notNull(),
    /** Sidebar icon (an emoji the saver picks). */
    icon: text("icon"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })]
);

/** 1-5 star reviews with text; one per user per work. */
export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["journal", "series"] }).notNull(),
    itemId: text("item_id").notNull(),
    rating: integer("rating").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.kind, t.itemId)]
);

/** Follows on a series — get notified when new volumes are published. */
export const seriesFollows = pgTable(
  "series_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.seriesId] })]
);

/**
 * In-app notifications. type: friend_request | friend_accept | new_follower |
 * review | new_volume | new_work. actorId is who caused it; kind/itemId point
 * at the related work when there is one.
 */
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind"),
  itemId: text("item_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Last-opened works per user — powers the "jump back in" shelf. */
export const readingActivity = pgTable(
  "reading_activity",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["journal", "series"] }).notNull(),
    itemId: text("item_id").notNull(),
    /** "read" or "listen" — picks the continue link. */
    mode: text("mode").notNull().default("read"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })]
);

/** User-made listening playlists (Spotify-style; shareable per visibility). */
export const playlists = pgTable("playlists", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Sidebar icon (emoji). */
  icon: text("icon"),
  /** Who can open this playlist (owner always can). */
  visibility: text("visibility", {
    enum: ["private", "friends", "public"],
  })
    .notNull()
    .default("private"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Audiobooks in a playlist, played in sortIndex order. */
export const playlistItems = pgTable(
  "playlist_items",
  {
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    journalId: text("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    sortIndex: integer("sort_index").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.playlistId, t.journalId] })]
);

/**
 * Access grants for works with "restricted" visibility: a pending row is a
 * request awaiting the owner; granted rows unlock the work. A series-level
 * grant covers every volume, current and future.
 */
export const accessGrants = pgTable(
  "access_grants",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["journal", "series"] }).notNull(),
    itemId: text("item_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "granted"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.kind, t.itemId, t.userId)]
);
