import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  canPostInChannel,
  channelInGroup,
  getChannel,
  listMessages,
  markChannelRead,
  memberMeta,
  memberRole,
  mentionTargets,
  postMessage,
  MAX_MESSAGE_LENGTH,
} from "@/lib/groups";
import { notify } from "@/lib/notifications";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";
import { isUserMuted, MUTED_ERROR } from "@/lib/reports";

export const runtime = "nodejs";

async function guard(
  request: Request,
  params: Promise<{ id: string; channelId: string }>
) {
  const session = await sessionFromRequest(request);
  if (!session) return { error: jsonError("Not signed in", 401) };
  const { id, channelId } = await params;
  if (!(await memberRole(id, session.user.id))) {
    return { error: jsonError("Members only", 403) };
  }
  if (!(await channelInGroup(id, channelId))) {
    return { error: jsonError("Channel not found", 404) };
  }
  return { session, channelId };
}

/** Channel history; ?after=<messageId> returns only newer (for polling). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const g = await guard(request, params);
  if ("error" in g) return g.error;
  const after =
    new URL(request.url).searchParams.get("after") ?? undefined;
  const messages = await listMessages(g.channelId, { after });
  // Fetching a channel's messages means the member is looking at it.
  await markChannelRead(g.session.user.id, g.channelId);
  return Response.json(
    { messages },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Post a message to the channel. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const limited = rateLimit(request, "group-messages", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const g = await guard(request, params);
  if ("error" in g) return g.error;

  // Anti-flood: the account itself is throttled, not just the network.
  const userLimited = rateLimitUser(g.session.user.id, "group-messages", {
    limit: 15,
    windowMs: 60_000,
  });
  if (userLimited) return userLimited;
  if (await isUserMuted(g.session.user.id)) {
    return jsonError(MUTED_ERROR, 403);
  }

  const body = (await request.json().catch(() => null)) as {
    body?: string;
    flag?: unknown;
  } | null;
  const text = body?.body?.trim() ?? "";
  if (!text) return jsonError("Say something first", 400);
  if (text.length > MAX_MESSAGE_LENGTH) {
    return jsonError(`Messages max out at ${MAX_MESSAGE_LENGTH} characters`, 400);
  }
  if (!isTextSafe(text)) return jsonError(UNSAFE_TEXT_ERROR, 400);
  const flag =
    body?.flag === "spoiler" || body?.flag === "nsfw" ? body.flag : null;

  // Channel posting restrictions (mods always may).
  const { id } = await params;
  const [channel, meta] = await Promise.all([
    getChannel(id, g.channelId),
    memberMeta(id, g.session.user.id),
  ]);
  if (!channel || !meta) return jsonError("Channel not found", 404);
  if (!canPostInChannel(channel, meta.role, meta.rankId)) {
    return jsonError("You don't have permission to post in this channel", 403);
  }

  const message = await postMessage(g.channelId, g.session.user.id, text, flag);

  // @mentions alert members (in-app + device push); group mutes suppress.
  const mentioned = await mentionTargets(id, text);
  for (const targetId of mentioned) {
    await notify(targetId, "mention", {
      actorId: g.session.user.id,
      kind: "group",
      itemId: id,
    });
  }

  return Response.json({ message });
}
