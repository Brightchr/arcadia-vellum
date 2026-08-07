import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { journals, series } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  resolveShareToken,
  recordShareOpen,
  appendedCookieValue,
  SHARE_COOKIE,
  SHARE_COOKIE_OPTIONS,
} from "@/lib/share";
import { isUserBanned } from "@/lib/profile";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Share-link entry point: validates the token, stamps the visitor's cookie,
 * counts the open, and redirects to the work. Revoked/expired links land on
 * a friendly explainer instead.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Tokens are 192-bit random — unguessable — but stall enumeration anyway.
  const limited = rateLimit(request, "share-redeem", {
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const { token } = await params;
  const link = await resolveShareToken(token);
  if (!link || (await isUserBanned(link.ownerId))) redirect("/link-expired");

  let target: string | null = null;
  if (link.kind === "journal") {
    const rows = await db
      .select({ slug: journals.slug })
      .from(journals)
      .where(eq(journals.id, link.itemId));
    target = rows[0] ? `/book/${rows[0].slug}` : null;
  } else {
    const rows = await db
      .select({ slug: series.slug })
      .from(series)
      .where(eq(series.id, link.itemId));
    target = rows[0] ? `/series/${rows[0].slug}` : null;
  }
  if (!target) redirect("/link-expired");

  await recordShareOpen(link.id);
  const jar = await cookies();
  jar.set(
    SHARE_COOKIE,
    appendedCookieValue(jar.get(SHARE_COOKIE)?.value ?? "", link.token),
    SHARE_COOKIE_OPTIONS
  );
  redirect(target);
}
