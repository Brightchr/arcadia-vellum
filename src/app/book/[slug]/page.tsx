import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import { getJournalBySlug } from "@/lib/journals";
import { workForJournal } from "@/lib/discovery";
import { listTracks } from "@/lib/audio";
import { listReviews } from "@/lib/reviews";
import { isSaved } from "@/lib/saves";
import { volumeLabel } from "@/lib/volume";
import { canAccessJournal, grantStatus, listGrants } from "@/lib/access";
import { isUserBanned } from "@/lib/profile";
import { isAdmin } from "@/lib/admin";
import { banReasonLabel } from "@/lib/ban-reasons";
import { RequestAccessButton } from "@/components/discover/RequestAccessButton";
import { AccessManager } from "@/components/discover/AccessManager";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { WorkCover } from "@/components/discover/WorkCard";
import { customThemeCssFor } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";
import { Stars } from "@/components/discover/StarRating";
import { SaveButton } from "@/components/discover/SaveButton";
import { ReviewsSection } from "@/components/discover/ReviewsSection";
import { BookOpenIcon, HeadphonesIcon, PenIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const journal = await getJournalBySlug(slug);
  return {
    title: journal ? `${journal.title} — Vellum` : "Vellum",
  };
}

/** Public homepage for a standalone book or audiobook. */
export default async function BookHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const journal = await getJournalBySlug(slug);
  if (!journal) notFound();

  const { session, navUser, pins, unread } = await shellData();
  const isOwner = session?.user.id === journal.ownerId;
  if (!isOwner && (await isUserBanned(journal.ownerId))) notFound();
  // Taken-down works 404 for everyone except the owner (who sees the ban
  // notice below) and admins (who need to review them).
  if (journal.bannedAt && !isOwner) {
    if (!session || !(await isAdmin(session.user.id))) notFound();
  }
  const canAccess = await canAccessJournal(session?.user.id ?? null, journal);
  // Everything except private has a homepage: discoverable works show their
  // teaser to all, friends-only works show a "friends can open this" teaser.
  // Unlisted works are invisible without a share link (canAccess covers it).
  if (!canAccess && (journal.visibility === "private" || !journal.listed)) {
    notFound();
  }
  const requestState =
    !canAccess && session
      ? await grantStatus(session.user.id, "journal", journal.id)
      : "none";
  const grants =
    isOwner && journal.visibility === "restricted"
      ? await listGrants("journal", journal.id)
      : [];

  const [work, reviews, tracks] = await Promise.all([
    workForJournal(journal),
    listReviews("journal", journal.id),
    journal.sourceType === "audio" ? listTracks(journal.id) : Promise.resolve([]),
  ]);
  const saved = session
    ? await isSaved(session.user.id, "journal", journal.id)
    : false;
  const vol = volumeLabel(journal);

  const customCss = await customThemeCssFor([work.theme]);

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <ThemeStyle css={customCss} />
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-10 space-y-8">
        {journal.bannedAt && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-5 py-4">
            <p className="font-heading text-red-300">
              This work has been banned and removed from view.
            </p>
            <p className="text-sm text-red-200/80 mt-1">
              Reason: {banReasonLabel(journal.banReason)}. It no longer appears
              in the store, search, or shared links — only you can open this
              page. If you believe this is a mistake, contact support.
            </p>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-[14rem_1fr] items-start">
          <WorkCover work={work} className="max-w-56" />
          <div className="space-y-3">
            <div>
              <h1 className="font-display text-3xl text-arcane-bright">
                {journal.title}
              </h1>
              {journal.subtitle && (
                <p className="text-ink-dim mt-1">{journal.subtitle}</p>
              )}
              <p className="text-sm text-ink-dim mt-1">
                {journal.author && <>by {journal.author} · </>}
                bound by{" "}
                {work.ownerUsername ? (
                  <Link
                    href={`/u/${work.ownerUsername}`}
                    className="text-arcane-bright hover:underline"
                  >
                    @{work.ownerUsername}
                  </Link>
                ) : (
                  work.ownerName
                )}
                {vol && <> · Vol. {vol}</>}
              </p>
            </div>

            {journal.description && (
              <p className="text-sm max-w-xl whitespace-pre-wrap">
                {journal.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-sm text-ink-dim">
              {work.avgRating !== null ? (
                <>
                  <Stars value={work.avgRating} />
                  <span>
                    {work.avgRating.toFixed(1)} · {work.ratingCount} review
                    {work.ratingCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span>No ratings yet</span>
              )}
              {journal.visibility !== "public" && (
                <span className="rounded bg-overlay px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider">
                  private preview
                </span>
              )}
            </div>

            {work.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {work.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/browse?tag=${encodeURIComponent(t)}`}
                    className="rounded-full bg-overlay px-2.5 py-1 text-xs font-heading uppercase tracking-wider text-ink-dim hover:text-ink"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {canAccess ? (
                work.hasAudio ? (
                  <Link href={`/j/${journal.slug}/listen`} className="btn-arcane">
                    <HeadphonesIcon /> Listen
                  </Link>
                ) : (
                  <Link href={`/j/${journal.slug}`} className="btn-arcane">
                    <BookOpenIcon /> Read
                  </Link>
                )
              ) : journal.visibility === "restricted" ? (
                <RequestAccessButton
                  kind="journal"
                  itemId={journal.id}
                  status={requestState === "pending" ? "pending" : "none"}
                  signedIn={!!session}
                />
              ) : (
                <span className="text-sm text-ink-dim">
                  Only the scribe's friends can open this tome.
                </span>
              )}
              <SaveButton
                kind="journal"
                itemId={journal.id}
                saved={saved}
                signedIn={!!session}
              />
              {isOwner && (
                <Link
                  href={`/journal/${journal.id}/settings`}
                  className="btn-ghost"
                >
                  <PenIcon /> Manage
                </Link>
              )}
            </div>
          </div>
        </div>

        {canAccess && tracks.length > 0 && (
          <section className="panel-arcane p-5 sm:p-6">
            <h2 className="font-heading text-lg mb-3">Episodes</h2>
            <ol className="space-y-1">
              {tracks.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-overlay text-sm"
                >
                  <span className="font-heading text-xs text-ink-dim w-5">
                    {i + 1}.
                  </span>
                  <span className="truncate">
                    {tracks.length === 1 ? journal.title : `Part ${i + 1}`}
                  </span>
                  {t.segmentIds.length > 1 && (
                    <span className="text-xs text-ink-dim">
                      {t.segmentIds.length} files
                    </span>
                  )}
                  <Link
                    href={`/j/${journal.slug}/listen`}
                    className="ml-auto text-xs font-heading text-arcane-bright hover:underline shrink-0"
                  >
                    Play
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {isOwner && journal.visibility === "restricted" && (
          <AccessManager kind="journal" itemId={journal.id} grants={grants} />
        )}

        <ReviewsSection
          kind="journal"
          itemId={journal.id}
          reviews={reviews.map((r) => ({
            ...r,
            updatedAt: r.updatedAt.toISOString(),
          }))}
          viewerId={session?.user.id ?? null}
          isOwner={isOwner ?? false}
          signedIn={!!session}
          canReview={canAccess}
        />
      </div>
      </AppShell>
    </main>
  );
}
