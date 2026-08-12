import { db } from "@/db";
import {
  channelMutes,
  channelReads,
  groupBans,
  groupChannels,
  groupInvites,
  groupMembers,
  groupMessages,
  groupMutes,
  groupRanks,
  groups,
  journals,
  series,
  user,
} from "@/db/schema";
import { and, asc, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { presenceFor, type FriendPresence } from "@/lib/presence";
import type { RelatedUser } from "@/lib/social";

export type Group = typeof groups.$inferSelect;

export type GroupRole = "owner" | "admin" | "member";

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: "public" | "private";
  ownerId: string;
  memberCount: number;
  onlineCount: number;
  joined: boolean;
  /** Pinned to the top of the member's social rail. */
  pinned: boolean;
}

const MAX_GROUPS_OWNED = 20;
const MAX_CHANNELS = 25;
export const MAX_GROUP_MEMBERS = 100;
export const MAX_MESSAGE_LENGTH = 2000;

/** Owners and admins can kick, ban, and manage channels. */
export function canModerate(role: GroupRole | null): boolean {
  return role === "owner" || role === "admin";
}

// --- Groups -----------------------------------------------------------------

export async function createGroup(
  ownerId: string,
  input: {
    name: string;
    description?: string | null;
    icon?: string | null;
    visibility?: "public" | "private";
  }
): Promise<Group | { error: string }> {
  const owned = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(groups)
    .where(eq(groups.ownerId, ownerId));
  if ((owned[0]?.n ?? 0) >= MAX_GROUPS_OWNED) {
    return { error: "You've reached the limit of groups you can own." };
  }
  const id = newId();
  const [group] = await db
    .insert(groups)
    .values({
      id,
      ownerId,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      visibility: input.visibility ?? "public",
    })
    .returning();
  await db.insert(groupMembers).values({
    groupId: id,
    userId: ownerId,
    role: "owner",
  });
  await db.insert(groupChannels).values({
    id: newId(),
    groupId: id,
    name: "general",
    sortIndex: 0,
  });
  return group;
}

export async function getGroup(id: string): Promise<Group | null> {
  const rows = await db.select().from(groups).where(eq(groups.id, id));
  return rows[0] ?? null;
}

export async function memberRole(
  groupId: string,
  userId: string
): Promise<GroupRole | null> {
  const rows = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
  return rows[0]?.role ?? null;
}

export async function isBannedFromGroup(groupId: string, userId: string) {
  const rows = await db
    .select({ userId: groupBans.userId })
    .from(groupBans)
    .where(and(eq(groupBans.groupId, groupId), eq(groupBans.userId, userId)));
  return rows.length > 0;
}

async function memberCounts(
  groupIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (groupIds.length === 0) return map;
  const rows = await db
    .select({ groupId: groupMembers.groupId, n: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId, groupIds))
    .groupBy(groupMembers.groupId);
  for (const r of rows) map.set(r.groupId, r.n);
  return map;
}

/** Online member counts per group (heartbeats within the online window). */
async function onlineCounts(groupIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (groupIds.length === 0) return map;
  const rows = await db
    .select({ groupId: groupMembers.groupId, n: sql<number>`count(*)::int` })
    .from(groupMembers)
    .innerJoin(user, eq(groupMembers.userId, user.id))
    .where(
      and(
        inArray(groupMembers.groupId, groupIds),
        sql`${user.lastSeenAt} > now() - interval '5 minutes'`
      )
    )
    .groupBy(groupMembers.groupId);
  for (const r of rows) map.set(r.groupId, r.n);
  return map;
}

async function summarize(
  rows: Group[],
  joinedIds: Set<string>,
  pinnedIds: Set<string> = new Set()
): Promise<GroupSummary[]> {
  const ids = rows.map((g) => g.id);
  const [members, online] = await Promise.all([
    memberCounts(ids),
    onlineCounts(ids),
  ]);
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    icon: g.icon,
    visibility: g.visibility,
    ownerId: g.ownerId,
    memberCount: members.get(g.id) ?? 0,
    onlineCount: online.get(g.id) ?? 0,
    joined: joinedIds.has(g.id),
    pinned: pinnedIds.has(g.id),
  }));
}

/** Groups the user belongs to — pinned first, then by name. */
export async function listGroupsForUser(
  userId: string
): Promise<GroupSummary[]> {
  const rows = await db
    .select({ group: groups, pinned: groupMembers.pinned })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groups.name));
  const mine = rows.map((r) => r.group);
  const pinnedIds = new Set(
    rows.filter((r) => r.pinned).map((r) => r.group.id)
  );
  const out = await summarize(mine, new Set(mine.map((g) => g.id)), pinnedIds);
  return out.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name)
  );
}

/** Pin/unpin a group on the member's social rail. */
export async function setGroupPinned(
  groupId: string,
  userId: string,
  pinned: boolean
) {
  await db
    .update(groupMembers)
    .set({ pinned })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
}

/** Public groups directory (largest first), flagged with membership. */
export async function listPublicGroups(
  userId: string,
  limit = 50
): Promise<GroupSummary[]> {
  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.visibility, "public"))
    .limit(limit);
  const memberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  const joined = new Set(memberships.map((m) => m.groupId));
  const out = await summarize(rows, joined);
  return out.sort((a, b) => b.memberCount - a.memberCount);
}

export async function hasInvite(groupId: string, userId: string) {
  const rows = await db
    .select({ userId: groupInvites.userId })
    .from(groupInvites)
    .where(
      and(eq(groupInvites.groupId, groupId), eq(groupInvites.userId, userId))
    );
  return rows.length > 0;
}

/** Join a public group, or a private one the user was invited to. */
export async function joinGroup(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const group = await getGroup(groupId);
  if (!group) return { ok: false, error: "Group not found" };
  if (await isBannedFromGroup(groupId, userId)) {
    return { ok: false, error: "You've been banned from this group" };
  }
  if (group.visibility === "private" && !(await hasInvite(groupId, userId))) {
    return { ok: false, error: "This group is invite-only" };
  }
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  if ((count?.n ?? 0) >= MAX_GROUP_MEMBERS) {
    return { ok: false, error: "This group is full" };
  }
  await db
    .insert(groupMembers)
    .values({ groupId, userId, role: "member" })
    .onConflictDoNothing();
  await db
    .delete(groupInvites)
    .where(
      and(eq(groupInvites.groupId, groupId), eq(groupInvites.userId, userId))
    );
  return { ok: true };
}

/** Kick a member (moderator action). Owners can't be kicked. */
export async function kickMember(groupId: string, targetId: string) {
  const role = await memberRole(groupId, targetId);
  if (role === "owner") return { ok: false, error: "The owner can't be removed" };
  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId))
    );
  return { ok: true };
}

/** Ban a member: removes them, blocks rejoin, clears standing invites. */
export async function banMember(
  groupId: string,
  targetId: string,
  bannedBy: string
) {
  const role = await memberRole(groupId, targetId);
  if (role === "owner") return { ok: false, error: "The owner can't be banned" };
  await db
    .insert(groupBans)
    .values({ groupId, userId: targetId, bannedBy })
    .onConflictDoNothing();
  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId))
    );
  await db
    .delete(groupInvites)
    .where(
      and(eq(groupInvites.groupId, groupId), eq(groupInvites.userId, targetId))
    );
  return { ok: true };
}

/** Promote to admin or demote to member (owner-only action). */
export async function setMemberRole(
  groupId: string,
  targetId: string,
  role: "admin" | "member"
) {
  const current = await memberRole(groupId, targetId);
  if (!current) return { ok: false, error: "Not a member" };
  if (current === "owner") {
    return { ok: false, error: "The owner's role can't change" };
  }
  await db
    .update(groupMembers)
    .set({ role })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId))
    );
  return { ok: true };
}

/** Leave a group. The owner can't leave — they delete the group instead. */
export async function leaveGroup(
  groupId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const role = await memberRole(groupId, userId);
  if (role === "owner") {
    return { ok: false, error: "Owners can't leave — delete the group instead" };
  }
  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
  return { ok: true };
}

export async function inviteToGroup(
  groupId: string,
  userId: string,
  invitedBy: string
) {
  await db
    .insert(groupInvites)
    .values({ groupId, userId, invitedBy })
    .onConflictDoNothing();
}

export type MemberWithPresence = FriendPresence & {
  role: GroupRole;
  rankId: string | null;
};

/** Members with presence + reading status, online first, owner pinned. */
export async function listMembersWithPresence(
  groupId: string
): Promise<MemberWithPresence[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      avatarImageId: user.avatarImageId,
      role: groupMembers.role,
      rankId: groupMembers.rankId,
    })
    .from(groupMembers)
    .innerJoin(user, eq(groupMembers.userId, user.id))
    .where(eq(groupMembers.groupId, groupId));
  const metaMap = new Map(
    rows.map((r) => [r.id, { role: r.role, rankId: r.rankId }])
  );
  const withPresence = await presenceFor(
    rows.map(({ id, name, username, avatarImageId }) => ({
      id,
      name,
      username,
      avatarImageId,
    }))
  );
  const rank: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };
  return withPresence
    .map((m) => ({
      ...m,
      role: (metaMap.get(m.id)?.role ?? "member") as GroupRole,
      rankId: metaMap.get(m.id)?.rankId ?? null,
    }))
    .sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        rank[a.role] - rank[b.role] ||
        a.name.localeCompare(b.name)
    );
}

/** One member's role + rank in a single lookup (post-permission checks). */
export async function memberMeta(
  groupId: string,
  userId: string
): Promise<{ role: GroupRole; rankId: string | null } | null> {
  const rows = await db
    .select({ role: groupMembers.role, rankId: groupMembers.rankId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    );
  return rows[0] ?? null;
}

// --- Ranks -------------------------------------------------------------------

const MAX_RANKS = 15;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export interface Rank {
  id: string;
  name: string;
  color: string;
  sortIndex: number;
}

export async function listRanks(groupId: string): Promise<Rank[]> {
  return db
    .select({
      id: groupRanks.id,
      name: groupRanks.name,
      color: groupRanks.color,
      sortIndex: groupRanks.sortIndex,
    })
    .from(groupRanks)
    .where(eq(groupRanks.groupId, groupId))
    .orderBy(asc(groupRanks.sortIndex), asc(groupRanks.createdAt));
}

export async function createRank(
  groupId: string,
  name: string,
  color: string
): Promise<Rank | { error: string }> {
  const clean = name.trim().slice(0, 24);
  if (!clean) return { error: "Give the rank a name" };
  if (!HEX_COLOR.test(color)) return { error: "Pick a valid color" };
  const existing = await listRanks(groupId);
  if (existing.length >= MAX_RANKS) {
    return { error: "This group has reached its rank limit." };
  }
  if (existing.some((r) => r.name.toLowerCase() === clean.toLowerCase())) {
    return { error: "A rank with that name already exists." };
  }
  const [row] = await db
    .insert(groupRanks)
    .values({
      id: newId(),
      groupId,
      name: clean,
      color: color.toLowerCase(),
      sortIndex: (existing.at(-1)?.sortIndex ?? 0) + 1,
    })
    .returning();
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortIndex: row.sortIndex,
  };
}

export async function updateRank(
  groupId: string,
  rankId: string,
  patch: { name?: string; color?: string }
): Promise<{ ok: boolean; error?: string }> {
  const set: Partial<typeof groupRanks.$inferInsert> = {};
  if (patch.name !== undefined) {
    const clean = patch.name.trim().slice(0, 24);
    if (!clean) return { ok: false, error: "Give the rank a name" };
    set.name = clean;
  }
  if (patch.color !== undefined) {
    if (!HEX_COLOR.test(patch.color)) {
      return { ok: false, error: "Pick a valid color" };
    }
    set.color = patch.color.toLowerCase();
  }
  if (Object.keys(set).length === 0) return { ok: false, error: "Nothing to update" };
  await db
    .update(groupRanks)
    .set(set)
    .where(and(eq(groupRanks.id, rankId), eq(groupRanks.groupId, groupId)));
  return { ok: true };
}

/** Delete a rank: holders lose it; rank-restricted channels drop the id. */
export async function deleteRank(groupId: string, rankId: string) {
  await db
    .update(groupMembers)
    .set({ rankId: null })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.rankId, rankId))
    );
  const channels = await db
    .select({ id: groupChannels.id, postRanks: groupChannels.postRanks })
    .from(groupChannels)
    .where(eq(groupChannels.groupId, groupId));
  for (const c of channels) {
    const ids = parseRankIds(c.postRanks);
    if (!ids.includes(rankId)) continue;
    await db
      .update(groupChannels)
      .set({ postRanks: JSON.stringify(ids.filter((x) => x !== rankId)) })
      .where(eq(groupChannels.id, c.id));
  }
  await db
    .delete(groupRanks)
    .where(and(eq(groupRanks.id, rankId), eq(groupRanks.groupId, groupId)));
}

/** Assign (or clear, with null) a member's rank. */
export async function assignRank(
  groupId: string,
  targetId: string,
  rankId: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (rankId) {
    const ranks = await listRanks(groupId);
    if (!ranks.some((r) => r.id === rankId)) {
      return { ok: false, error: "Rank not found" };
    }
  }
  await db
    .update(groupMembers)
    .set({ rankId })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId))
    );
  return { ok: true };
}

// --- Channels ---------------------------------------------------------------

export type PostMode = "everyone" | "mods" | "ranks";

export interface Channel {
  id: string;
  name: string;
  sortIndex: number;
  nsfw: boolean;
  postMode: PostMode;
  /** Rank ids allowed to post when postMode is "ranks" (mods always can). */
  postRanks: string[];
}

/** Per-user view of a channel: adds mute + unread state. */
export interface ChannelState extends Channel {
  muted: boolean;
  unread: boolean;
}

function parseRankIds(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

const channelCols = {
  id: groupChannels.id,
  name: groupChannels.name,
  sortIndex: groupChannels.sortIndex,
  nsfw: groupChannels.nsfw,
  postMode: groupChannels.postMode,
  postRanks: groupChannels.postRanks,
};

function toChannel(row: {
  id: string;
  name: string;
  sortIndex: number;
  nsfw: boolean;
  postMode: PostMode;
  postRanks: string | null;
}): Channel {
  return { ...row, postRanks: parseRankIds(row.postRanks) };
}

export async function listChannels(groupId: string): Promise<Channel[]> {
  const rows = await db
    .select(channelCols)
    .from(groupChannels)
    .where(eq(groupChannels.groupId, groupId))
    .orderBy(asc(groupChannels.sortIndex), asc(groupChannels.createdAt));
  return rows.map(toChannel);
}

/** Channels with this member's mute + unread state. */
export async function listChannelsForUser(
  groupId: string,
  userId: string
): Promise<ChannelState[]> {
  const [channels, mutes, unreadRows] = await Promise.all([
    listChannels(groupId),
    db
      .select({ channelId: channelMutes.channelId })
      .from(channelMutes)
      .innerJoin(
        groupChannels,
        eq(channelMutes.channelId, groupChannels.id)
      )
      .where(
        and(
          eq(channelMutes.userId, userId),
          eq(groupChannels.groupId, groupId)
        )
      ),
    db
      .select({ channelId: groupMessages.channelId })
      .from(groupMessages)
      .innerJoin(
        groupChannels,
        eq(groupMessages.channelId, groupChannels.id)
      )
      .leftJoin(
        channelReads,
        and(
          eq(channelReads.channelId, groupMessages.channelId),
          eq(channelReads.userId, userId)
        )
      )
      .where(
        and(
          eq(groupChannels.groupId, groupId),
          ne(groupMessages.userId, userId),
          sql`${groupMessages.createdAt} > coalesce(${channelReads.lastReadAt}, 'epoch'::timestamp)`
        )
      )
      .groupBy(groupMessages.channelId),
  ]);
  const mutedSet = new Set(mutes.map((m) => m.channelId));
  const unreadSet = new Set(unreadRows.map((r) => r.channelId));
  return channels.map((c) => ({
    ...c,
    muted: mutedSet.has(c.id),
    unread: unreadSet.has(c.id),
  }));
}

/** Owner/admin channel settings: rename, NSFW gate, posting restrictions. */
export async function updateChannel(
  groupId: string,
  channelId: string,
  patch: {
    name?: string;
    nsfw?: boolean;
    postMode?: PostMode;
    postRanks?: string[];
  }
): Promise<{ ok: boolean; error?: string }> {
  const set: Partial<typeof groupChannels.$inferInsert> = {};
  if (patch.name !== undefined) {
    const clean = patch.name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    if (!clean) return { ok: false, error: "Channel names need letters or numbers." };
    set.name = clean;
  }
  if (patch.nsfw !== undefined) set.nsfw = patch.nsfw;
  if (patch.postMode !== undefined) set.postMode = patch.postMode;
  if (patch.postRanks !== undefined) {
    const ranks = await listRanks(groupId);
    const valid = new Set(ranks.map((r) => r.id));
    set.postRanks = JSON.stringify(
      patch.postRanks.filter((id) => valid.has(id))
    );
  }
  if (Object.keys(set).length === 0) return { ok: false, error: "Nothing to update" };
  await db
    .update(groupChannels)
    .set(set)
    .where(
      and(eq(groupChannels.id, channelId), eq(groupChannels.groupId, groupId))
    );
  return { ok: true };
}

/** Whether this member may post in the channel (mods always may). */
export function canPostInChannel(
  channel: Pick<Channel, "postMode" | "postRanks">,
  role: GroupRole,
  rankId: string | null
): boolean {
  if (canModerate(role)) return true;
  if (channel.postMode === "everyone") return true;
  if (channel.postMode === "mods") return false;
  return !!rankId && channel.postRanks.includes(rankId);
}

export async function getChannel(
  groupId: string,
  channelId: string
): Promise<Channel | null> {
  const rows = await db
    .select(channelCols)
    .from(groupChannels)
    .where(
      and(eq(groupChannels.id, channelId), eq(groupChannels.groupId, groupId))
    );
  return rows[0] ? toChannel(rows[0]) : null;
}

// --- Mutes & read markers -----------------------------------------------------

export async function setGroupMuted(
  groupId: string,
  userId: string,
  muted: boolean
) {
  if (muted) {
    await db
      .insert(groupMutes)
      .values({ userId, groupId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(groupMutes)
      .where(
        and(eq(groupMutes.userId, userId), eq(groupMutes.groupId, groupId))
      );
  }
}

export async function setChannelMuted(
  channelId: string,
  userId: string,
  muted: boolean
) {
  if (muted) {
    await db
      .insert(channelMutes)
      .values({ userId, channelId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(channelMutes)
      .where(
        and(
          eq(channelMutes.userId, userId),
          eq(channelMutes.channelId, channelId)
        )
      );
  }
}

/** Viewing a channel marks it read. */
export async function markChannelRead(userId: string, channelId: string) {
  await db
    .insert(channelReads)
    .values({ userId, channelId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [channelReads.userId, channelReads.channelId],
      set: { lastReadAt: new Date() },
    });
}

/**
 * Group ids (of the given set) with unread activity for this user — muted
 * channels and muted groups don't count. Powers the rail's unread dots.
 */
export async function unreadGroupIds(
  userId: string,
  groupIds: string[]
): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();
  const mutedGroups = await db
    .select({ groupId: groupMutes.groupId })
    .from(groupMutes)
    .where(eq(groupMutes.userId, userId));
  const mutedGroupSet = new Set(mutedGroups.map((m) => m.groupId));
  const candidates = groupIds.filter((id) => !mutedGroupSet.has(id));
  if (candidates.length === 0) return new Set();

  const rows = await db
    .select({ groupId: groupChannels.groupId })
    .from(groupMessages)
    .innerJoin(groupChannels, eq(groupMessages.channelId, groupChannels.id))
    .leftJoin(
      channelReads,
      and(
        eq(channelReads.channelId, groupMessages.channelId),
        eq(channelReads.userId, userId)
      )
    )
    .leftJoin(
      channelMutes,
      and(
        eq(channelMutes.channelId, groupMessages.channelId),
        eq(channelMutes.userId, userId)
      )
    )
    .where(
      and(
        inArray(groupChannels.groupId, candidates),
        isNull(channelMutes.userId),
        ne(groupMessages.userId, userId),
        sql`${groupMessages.createdAt} > coalesce(${channelReads.lastReadAt}, 'epoch'::timestamp)`
      )
    )
    .groupBy(groupChannels.groupId);
  return new Set(rows.map((r) => r.groupId));
}

/** Group ids this user muted. */
export async function mutedGroupIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ groupId: groupMutes.groupId })
    .from(groupMutes)
    .where(eq(groupMutes.userId, userId));
  return new Set(rows.map((r) => r.groupId));
}

export async function createChannel(
  groupId: string,
  name: string
): Promise<Channel | { error: string }> {
  const existing = await listChannels(groupId);
  if (existing.length >= MAX_CHANNELS) {
    return { error: "This group has reached its channel limit." };
  }
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  if (!clean) return { error: "Channel names need letters or numbers." };
  if (existing.some((c) => c.name === clean)) {
    return { error: "A channel with that name already exists." };
  }
  const [row] = await db
    .insert(groupChannels)
    .values({
      id: newId(),
      groupId,
      name: clean,
      sortIndex: (existing.at(-1)?.sortIndex ?? 0) + 1,
    })
    .returning();
  return {
    id: row.id,
    name: row.name,
    sortIndex: row.sortIndex,
    nsfw: row.nsfw,
    postMode: row.postMode,
    postRanks: parseRankIds(row.postRanks),
  };
}

export async function deleteChannel(groupId: string, channelId: string) {
  const remaining = await listChannels(groupId);
  if (remaining.length <= 1) {
    return { ok: false, error: "Groups need at least one channel" };
  }
  await db
    .delete(groupChannels)
    .where(
      and(eq(groupChannels.id, channelId), eq(groupChannels.groupId, groupId))
    );
  return { ok: true };
}

export async function channelInGroup(groupId: string, channelId: string) {
  const rows = await db
    .select({ id: groupChannels.id })
    .from(groupChannels)
    .where(
      and(eq(groupChannels.id, channelId), eq(groupChannels.groupId, groupId))
    );
  return rows.length > 0;
}

// --- Messages ---------------------------------------------------------------

/** An embedded work card for a Vellum link pasted into a message. */
export interface WorkEmbed {
  kind: "journal" | "series";
  slug: string;
  title: string;
  author: string | null;
  theme: string;
  coverImageId: string | null;
  href: string;
}

export type MessageFlag = "spoiler" | "nsfw";

export interface GroupMessage {
  id: string;
  body: string;
  /** Content warning set by the sender — render hidden until clicked. */
  flag: MessageFlag | null;
  createdAt: number;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarId: string | null;
  embeds: WorkEmbed[];
}

const WORK_LINK = /\/(book|series)\/([a-z0-9][a-z0-9-]*)/g;

/** Resolve /book/<slug> and /series/<slug> links to public-work embeds. */
async function resolveEmbeds(
  bodies: { id: string; body: string }[]
): Promise<Map<string, WorkEmbed[]>> {
  const bookSlugs = new Set<string>();
  const seriesSlugs = new Set<string>();
  const perMessage = new Map<string, { kind: string; slug: string }[]>();
  for (const m of bodies) {
    const links: { kind: string; slug: string }[] = [];
    for (const match of m.body.matchAll(WORK_LINK)) {
      const [, kind, slug] = match;
      if (links.length >= 3) break;
      if (links.some((l) => l.kind === kind && l.slug === slug)) continue;
      links.push({ kind, slug });
      if (kind === "book") bookSlugs.add(slug);
      else seriesSlugs.add(slug);
    }
    if (links.length > 0) perMessage.set(m.id, links);
  }
  if (perMessage.size === 0) return new Map();

  const [journalRows, seriesRows] = await Promise.all([
    bookSlugs.size > 0
      ? db
          .select({
            slug: journals.slug,
            title: journals.title,
            author: journals.author,
            theme: journals.theme,
            coverImageId: journals.coverImageId,
            visibility: journals.visibility,
          })
          .from(journals)
          .where(inArray(journals.slug, [...bookSlugs]))
      : Promise.resolve([]),
    seriesSlugs.size > 0
      ? db
          .select({
            slug: series.slug,
            name: series.name,
            id: series.id,
          })
          .from(series)
          .where(inArray(series.slug, [...seriesSlugs]))
      : Promise.resolve([]),
  ]);
  // Series cover/theme come from any volume with art.
  const seriesArt = new Map<
    string,
    { theme: string; coverImageId: string | null; author: string | null }
  >();
  if (seriesRows.length > 0) {
    const vols = await db
      .select({
        seriesId: journals.seriesId,
        theme: journals.theme,
        coverImageId: journals.coverImageId,
        author: journals.author,
      })
      .from(journals)
      .where(
        inArray(
          journals.seriesId,
          seriesRows.map((s) => s.id)
        )
      );
    for (const v of vols) {
      if (!v.seriesId) continue;
      const cur = seriesArt.get(v.seriesId);
      if (!cur || (!cur.coverImageId && v.coverImageId)) {
        seriesArt.set(v.seriesId, {
          theme: v.theme,
          coverImageId: v.coverImageId,
          author: v.author,
        });
      }
    }
  }

  const journalMap = new Map(
    journalRows
      .filter((j) => j.visibility === "public" || j.visibility === "restricted")
      .map((j) => [j.slug, j])
  );
  const seriesMap = new Map(seriesRows.map((s) => [s.slug, s]));

  const out = new Map<string, WorkEmbed[]>();
  for (const [messageId, links] of perMessage) {
    const embeds: WorkEmbed[] = [];
    for (const l of links) {
      if (l.kind === "book") {
        const j = journalMap.get(l.slug);
        if (!j) continue;
        embeds.push({
          kind: "journal",
          slug: j.slug,
          title: j.title,
          author: j.author,
          theme: j.theme,
          coverImageId: j.coverImageId,
          href: `/book/${j.slug}`,
        });
      } else {
        const s = seriesMap.get(l.slug);
        if (!s) continue;
        const art = seriesArt.get(s.id);
        embeds.push({
          kind: "series",
          slug: s.slug,
          title: s.name,
          author: art?.author ?? null,
          theme: art?.theme ?? "witch-grimoire",
          coverImageId: art?.coverImageId ?? null,
          href: `/series/${s.slug}`,
        });
      }
    }
    if (embeds.length > 0) out.set(messageId, embeds);
  }
  return out;
}

/**
 * Messages in a channel, oldest→newest. Pass `after` (a message id) to get
 * only newer messages — that's what the client polls with.
 */
export async function listMessages(
  channelId: string,
  opts: { after?: string; limit?: number } = {}
): Promise<GroupMessage[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  let afterTime: Date | null = null;
  if (opts.after) {
    const rows = await db
      .select({ createdAt: groupMessages.createdAt })
      .from(groupMessages)
      .where(eq(groupMessages.id, opts.after));
    afterTime = rows[0]?.createdAt ?? null;
  }
  const rows = await db
    .select({
      id: groupMessages.id,
      body: groupMessages.body,
      flag: groupMessages.flag,
      createdAt: groupMessages.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorUsername: user.username,
      authorAvatarId: user.avatarImageId,
    })
    .from(groupMessages)
    .innerJoin(user, eq(groupMessages.userId, user.id))
    .where(
      afterTime
        ? and(
            eq(groupMessages.channelId, channelId),
            gt(groupMessages.createdAt, afterTime)
          )
        : eq(groupMessages.channelId, channelId)
    )
    .orderBy(desc(groupMessages.createdAt))
    .limit(limit);

  const ordered = rows.reverse();
  const embeds = await resolveEmbeds(
    ordered.map((r) => ({ id: r.id, body: r.body }))
  );
  return ordered.map((r) => ({
    id: r.id,
    body: r.body,
    flag: r.flag,
    createdAt: r.createdAt.getTime(),
    authorId: r.authorId,
    authorName: r.authorName,
    authorUsername: r.authorUsername,
    authorAvatarId: r.authorAvatarId,
    embeds: embeds.get(r.id) ?? [],
  }));
}

export async function postMessage(
  channelId: string,
  userId: string,
  body: string,
  flag: MessageFlag | null = null
): Promise<GroupMessage> {
  const [row] = await db
    .insert(groupMessages)
    .values({ id: newId(), channelId, userId, body, flag })
    .returning();
  const [author] = await db
    .select({
      name: user.name,
      username: user.username,
      avatarImageId: user.avatarImageId,
    })
    .from(user)
    .where(eq(user.id, userId));
  const embeds = await resolveEmbeds([{ id: row.id, body: row.body }]);
  return {
    id: row.id,
    body: row.body,
    flag: row.flag,
    createdAt: row.createdAt.getTime(),
    authorId: userId,
    authorName: author?.name ?? "Unknown",
    authorUsername: author?.username ?? null,
    authorAvatarId: author?.avatarImageId ?? null,
    embeds: embeds.get(row.id) ?? [],
  };
}

/** Friends of the inviter who aren't members or already invited. */
export async function invitableFriends(
  groupId: string,
  friends: RelatedUser[]
): Promise<RelatedUser[]> {
  if (friends.length === 0) return [];
  const ids = friends.map((f) => f.id);
  const [members, invites] = await Promise.all([
    db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          inArray(groupMembers.userId, ids)
        )
      ),
    db
      .select({ userId: groupInvites.userId })
      .from(groupInvites)
      .where(
        and(
          eq(groupInvites.groupId, groupId),
          inArray(groupInvites.userId, ids)
        )
      ),
  ]);
  const excluded = new Set([
    ...members.map((m) => m.userId),
    ...invites.map((i) => i.userId),
  ]);
  return friends.filter((f) => !excluded.has(f.id));
}
