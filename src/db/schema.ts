import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  customType,
  index,
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
  /** Null = permanent while banned; a date = suspension that auto-expires. */
  bannedUntil: timestamp("banned_until"),
  /** Ban reason code (see src/lib/ban-reasons.ts) — shown at sign-in. */
  banReason: text("ban_reason"),
  /** JSON array ordering the profile sections, e.g. ["bio","featured","works","saved"]. */
  profileLayout: text("profile_layout"),
  /** Last presence heartbeat — "online" means within the last few minutes. */
  lastSeenAt: timestamp("last_seen_at"),
  /** Let friends see what you're currently reading/listening to. */
  showReadingActivity: boolean("show_reading_activity").notNull().default(true),
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
  /**
   * JSON layout for the text over the cover art: whether the title/author
   * show at all and where each block sits (percent coordinates). Null means
   * the default layout.
   */
  coverLayout: text("cover_layout"),
  visibility: text("visibility", {
    enum: ["public", "friends", "restricted", "private"],
  })
    .notNull()
    .default("private"),
  /** Unchecked = unlisted: reachable by link but hidden from browse/search. */
  listed: boolean("listed").notNull().default(true),
  /** Featured works lead the owner's profile page. */
  featured: boolean("featured").notNull().default(false),
  /**
   * Admin takedown: hidden from store/search/share for everyone; the owner
   * still sees it (marked banned) on their own shelves.
   */
  bannedAt: timestamp("banned_at"),
  /** Takedown reason code (see src/lib/ban-reasons.ts) — shown to the owner. */
  banReason: text("ban_reason"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("journals_owner_id_idx").on(t.ownerId),
    index("journals_series_id_idx").on(t.seriesId),
  ]
);

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
  /** Legacy in-database bytes; null once the row lives in object storage. */
  data: bytea("data"),
  /** Object-storage key; when set, bytes are served from the bucket. */
  storageKey: text("storage_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("journal_audio_journal_id_idx").on(t.journalId)]
);

export const journalImages = pgTable("journal_images", {
  id: text("id").primaryKey(),
  journalId: text("journal_id")
    .notNull()
    .references(() => journals.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  /** Legacy in-database bytes; null once the row lives in object storage. */
  data: bytea("data"),
  /** Object-storage key; when set, bytes are served from the bucket. */
  storageKey: text("storage_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("journal_images_journal_id_idx").on(t.journalId)]
);

/**
 * User-built themes from the theme builder. config is validated JSON
 * (colors, fonts, textures, ambience — all from fixed whitelists). Journals
 * reference one as theme = "custom-<id>".
 */
export const userThemes = pgTable("user_themes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  config: text("config").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  /** Legacy in-database bytes; null once the row lives in object storage. */
  data: bytea("data"),
  /** Object-storage key; when set, bytes are served from the bucket. */
  storageKey: text("storage_key"),
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
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_id_idx").on(t.followingId),
  ]
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
  (t) => [
    unique().on(t.requesterId, t.addresseeId),
    index("friendships_addressee_id_idx").on(t.addresseeId),
  ]
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
  (t) => [
    primaryKey({ columns: [t.journalId, t.tagId] }),
    index("journal_tags_tag_id_idx").on(t.tagId),
  ]
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
  (t) => [
    primaryKey({ columns: [t.userId, t.kind, t.itemId] }),
    index("saved_items_item_id_idx").on(t.itemId),
  ]
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
  (t) => [
    unique().on(t.userId, t.kind, t.itemId),
    index("reviews_item_id_idx").on(t.itemId),
  ]
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
  },
  (t) => [
    index("notifications_user_read_idx").on(t.userId, t.read),
    // listNotifications sorts newest-first per user on every social poll.
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
  ]
);

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
 * Named, revocable share links (Google Docs-style). A valid link grants
 * read/listen access to its journal — or every volume of its series —
 * whatever the work's visibility. Deleting the row revokes everyone who
 * came in through it; expiry is optional.
 */
export const shareLinks = pgTable("share_links", {
  id: text("id").primaryKey(),
  /** High-entropy URL token: /share/<token>. */
  token: text("token").notNull().unique(),
  kind: text("kind", { enum: ["journal", "series"] }).notNull(),
  itemId: text("item_id").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Author-facing name, e.g. "sent to my table". */
  label: text("label").notNull(),
  expiresAt: timestamp("expires_at"),
  openCount: integer("open_count").notNull().default(0),
  lastOpenedAt: timestamp("last_opened_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Web Push endpoints, one row per browser/device a user enabled
 * notifications on. Dead endpoints (unsubscribed/expired) are pruned when a
 * send bounces.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // Every push send looks up a user's devices.
  (t) => [index("push_subscriptions_user_idx").on(t.userId)]
);

/**
 * Network-level bans: sign-in and sign-up are refused from these addresses.
 * Rows usually come from banning an account's known session IPs, but can be
 * added by hand. expiresAt null = permanent.
 */
export const ipBans = pgTable("ip_bans", {
  id: text("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  /** Ban reason code (see src/lib/ban-reasons.ts). */
  reason: text("reason").notNull(),
  /** The account whose network this was, when derived from a user ban. */
  targetUserId: text("target_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

/**
 * Audit trail of moderation actions (bans, unbans). Append-only — rows are
 * never updated or deleted, so there's always a record of who did what.
 */
export const adminActions = pgTable("admin_actions", {
  id: text("id").primaryKey(),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  targetUserId: text("target_user_id").references(() => user.id, {
    onDelete: "cascade",
  }),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Groups — Discord-style text communities (no voice)
// ---------------------------------------------------------------------------

/**
 * A group: a shared space with text channels where members chat and link
 * works. Public groups appear in the directory and anyone can join; private
 * ones are joinable only through a friend invite.
 */
export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  /** Tile icon (an emoji the owner picks) — fallback when no image is set. */
  icon: text("icon"),
  /** Uploaded group avatar (profile_images id, served via /api/avatars). */
  imageId: text("image_id"),
  visibility: text("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("public"),
  /** Shown as a banner at the top of the default channel (Discord-style). */
  welcomeMessage: text("welcome_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Custom ranks: a colored label per member (one rank each) that also gates
 * posting in rank-restricted channels. Moderation power stays with the
 * owner/admin roles — ranks are identity + channel access.
 */
export const groupRanks = pgTable("group_ranks", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Hex color for the member's name, e.g. "#e0be6a". */
  color: text("color").notNull(),
  sortIndex: integer("sort_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Admins can kick/ban members and manage channels; owners also promote. */
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    /** Cosmetic/access rank (group_ranks id); cleared if the rank is deleted. */
    rankId: text("rank_id"),
    /** Pinned groups lead the member's social rail. */
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_members_user_id_idx").on(t.userId),
  ]
);

/** Users banned from a group — they can't rejoin or be re-invited. */
export const groupBans = pgTable(
  "group_bans",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bannedBy: text("banned_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })]
);

/**
 * Reports escalated to Vellum moderators (from group bans, for now). While a
 * user has an OPEN report they are muted platform-wide: no group messages, no
 * reviews. Admins resolve to "dismissed" (mute lifts) or "upheld" (usually
 * paired with a platform ban).
 */
export const userReports = pgTable(
  "user_reports",
  {
  id: text("id").primaryKey(),
  /** The reported user. */
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reportedBy: text("reported_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Where it happened, when group-related. */
  groupId: text("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  reason: text("reason", {
    enum: ["spam", "harassment", "inappropriate", "other"],
  }).notNull(),
  details: text("details"),
  status: text("status", { enum: ["open", "dismissed", "upheld"] })
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by").references(() => user.id, {
    onDelete: "set null",
  }),
  },
  // isUserMuted runs on every message post and review.
  (t) => [index("user_reports_user_status_idx").on(t.userId, t.status)]
);

/** Text channels within a group, in sortIndex order. */
export const groupChannels = pgTable("group_channels", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortIndex: integer("sort_index").notNull().default(0),
  /** Optional thumbnail (profile_images id) shown beside the channel name. */
  imageId: text("image_id"),
  /** Age/content gate: readers confirm before the channel renders. */
  nsfw: boolean("nsfw").notNull().default(false),
  /** Who may post: everyone, mods (owner+admins), or listed ranks (+mods). */
  postMode: text("post_mode", { enum: ["everyone", "mods", "ranks"] })
    .notNull()
    .default("everyone"),
  /** JSON array of group_ranks ids allowed to post when postMode="ranks". */
  postRanks: text("post_ranks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("group_channels_group_id_idx").on(t.groupId)]
);

/**
 * Standing invites into a group. Any member can invite a friend; the invite
 * lets that user join a private group (and shows a notification either way).
 */
export const groupInvites = pgTable(
  "group_invites",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })]
);

/**
 * Chat messages. Vellum links pasted in the body (/book/<slug>,
 * /series/<slug>, playlists) render as embedded work cards client-side.
 */
export const groupMessages = pgTable("group_messages", {
  id: text("id").primaryKey(),
  channelId: text("channel_id")
    .notNull()
    .references(() => groupChannels.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  /** Sender-set content warning: hidden until the reader clicks through. */
  flag: text("flag", { enum: ["spoiler", "nsfw"] }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("group_messages_channel_created_idx").on(t.channelId, t.createdAt),
  ]
);

/** Last time each member looked at a channel — powers unread dots. */
export const channelReads = pgTable(
  "channel_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => groupChannels.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] })]
);

/** Muted groups: no unread emphasis anywhere for this member. */
export const groupMutes = pgTable(
  "group_mutes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })]
);

/** Muted single channels. */
export const channelMutes = pgTable(
  "channel_mutes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => groupChannels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] })]
);

/**
 * "Not interested" marks — hides a work from the user's store and home feed
 * and counts against its tags in their taste profile.
 */
export const userDislikes = pgTable(
  "user_dislikes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["journal", "series"] }).notNull(),
    itemId: text("item_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })]
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
