import { db } from "@/db";
import { groups, user, userReports } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { notify } from "@/lib/notifications";

export {
  REPORT_REASONS,
  isReportReason,
  type ReportReason,
} from "@/lib/report-reasons";
import type { ReportReason } from "@/lib/report-reasons";

/**
 * True while the user has an open report — they're muted platform-wide
 * (no group messages, no reviews) until a Vellum admin resolves it.
 */
export async function isUserMuted(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userReports.id })
    .from(userReports)
    .where(and(eq(userReports.userId, userId), eq(userReports.status, "open")))
    .limit(1);
  return rows.length > 0;
}

export const MUTED_ERROR =
  "Your account is temporarily restricted while a report is reviewed.";

/** File a report (one open report per user per reporter — no dogpiles). */
export async function createReport(input: {
  userId: string;
  reportedBy: string;
  groupId?: string | null;
  reason: ReportReason;
  details?: string | null;
}) {
  const existing = await db
    .select({ id: userReports.id })
    .from(userReports)
    .where(
      and(
        eq(userReports.userId, input.userId),
        eq(userReports.reportedBy, input.reportedBy),
        eq(userReports.status, "open")
      )
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const id = newId();
  await db.insert(userReports).values({
    id,
    userId: input.userId,
    reportedBy: input.reportedBy,
    groupId: input.groupId ?? null,
    reason: input.reason,
    details: input.details ?? null,
  });
  // The reported user learns they're restricted — but not by whom.
  await notify(input.userId, "report_opened");
  return id;
}

export interface ReportView {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "dismissed" | "upheld";
  createdAt: Date;
  reportedId: string;
  reportedName: string;
  reportedUsername: string | null;
  reportedBanned: boolean;
  reporterName: string;
  reporterUsername: string | null;
  groupName: string | null;
}

const reporter = { id: user.id, name: user.name, username: user.username };

/** Reports for the admin queue — open first, then recent resolutions. */
export async function listReports(limit = 50): Promise<ReportView[]> {
  const reported = user;
  const rows = await db
    .select({
      id: userReports.id,
      reason: userReports.reason,
      details: userReports.details,
      status: userReports.status,
      createdAt: userReports.createdAt,
      reportedId: reported.id,
      reportedName: reported.name,
      reportedUsername: reported.username,
      reportedBanned: reported.banned,
      reportedBy: userReports.reportedBy,
      groupId: userReports.groupId,
    })
    .from(userReports)
    .innerJoin(reported, eq(userReports.userId, reported.id))
    .orderBy(
      sql`case when ${userReports.status} = 'open' then 0 else 1 end`,
      desc(userReports.createdAt)
    )
    .limit(limit);
  if (rows.length === 0) return [];

  const reporterIds = [...new Set(rows.map((r) => r.reportedBy))];
  const groupIds = [
    ...new Set(rows.map((r) => r.groupId).filter((g): g is string => !!g)),
  ];
  const [reporters, groupRows] = await Promise.all([
    db.select(reporter).from(user).where(inArray(user.id, reporterIds)),
    groupIds.length > 0
      ? db
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(inArray(groups.id, groupIds))
      : Promise.resolve([]),
  ]);
  const repMap = new Map(reporters.map((r) => [r.id, r]));
  const grpMap = new Map(groupRows.map((g) => [g.id, g.name]));

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt,
    reportedId: r.reportedId,
    reportedName: r.reportedName,
    reportedUsername: r.reportedUsername,
    reportedBanned: r.reportedBanned,
    reporterName: repMap.get(r.reportedBy)?.name ?? "Unknown",
    reporterUsername: repMap.get(r.reportedBy)?.username ?? null,
    groupName: r.groupId ? (grpMap.get(r.groupId) ?? null) : null,
  }));
}

export async function openReportCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userReports)
    .where(eq(userReports.status, "open"));
  return row?.n ?? 0;
}

/**
 * Resolve a report. "dismissed" lifts the mute (if no other open reports);
 * "upheld" records the judgment — pair with a platform ban when warranted.
 */
export async function resolveReport(
  reportId: string,
  adminId: string,
  outcome: "dismissed" | "upheld"
): Promise<{ userId: string } | null> {
  const [row] = await db
    .update(userReports)
    .set({ status: outcome, resolvedAt: new Date(), resolvedBy: adminId })
    .where(and(eq(userReports.id, reportId), eq(userReports.status, "open")))
    .returning({ userId: userReports.userId });
  if (!row) return null;
  await notify(
    row.userId,
    outcome === "dismissed" ? "report_dismissed" : "report_upheld"
  );
  return row;
}
