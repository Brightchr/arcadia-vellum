import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import { getSeriesBySlug } from "@/lib/series";
import { seriesVolumes } from "@/lib/discovery";
import { listJournalTags } from "@/lib/tags";
import { listReviews } from "@/lib/reviews";
import { isSaved } from "@/lib/saves";
import { getUserById } from "@/lib/profile";
import { isFollowingSeries } from "@/lib/social";
import { FollowSeriesButton } from "@/components/social/FollowSeriesButton";
import { compareVolumes, volumeLabel } from "@/lib/volume";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { WorkCover } from "@/components/discover/WorkCard";
import { Stars } from "@/components/discover/StarRating";
import { SaveButton } from "@/components/discover/SaveButton";
import { ReviewsSection } from "@/components/discover/ReviewsSection";
import { BookOpenIcon, HeadphonesIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  return { title: s ? `${s.name} — Arcadia Vellum` : "Arcadia Vellum" };
}

/** Public homepage for a series: all volumes/episodes, tags, reviews. */
export default async function SeriesHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  if (!s) notFound();

  const { session, navUser, pins, unread } = await shellData();
  const isOwner = session?.user.id === s.ownerId;
  const volumes = (await seriesVolumes(s.id, isOwner ?? false)).sort(
    compareVolumes
  );
  if (volumes.length === 0) notFound();

  const [reviews, owner] = await Promise.all([
    listReviews("series", s.id),
    getUserById(s.ownerId),
  ]);
  const tagLists = await Promise.all(
    volumes.map((v) => listJournalTags(v.id))
  );
  const allTags = [...new Set(tagLists.flat())].sort();
  const saved = session ? await isSaved(session.user.id, "series", s.id) : false;
  const followingSeries = session
    ? await isFollowingSeries(session.user.id, s.id)
    : false;

  const hasWritten = volumes.some((v) => v.sourceType !== "audio");
  const hasAudio = volumes.some((v) => v.sourceType === "audio");
  const withCover = volumes.find((v) => v.coverImageId);
  const author = volumes.find((v) => v.author)?.author ?? null;
  const avg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-10 space-y-8">
        <div className="grid gap-6 md:grid-cols-[14rem_1fr] items-start">
          <WorkCover
            work={{
              title: s.name,
              author,
              theme: volumes[0].theme,
              coverImageId: withCover?.coverImageId ?? null,
            }}
            className="max-w-56"
          />
          <div className="space-y-3">
            <div>
              <h1 className="font-display text-3xl text-arcane-bright">
                {s.name}
              </h1>
              <p className="text-sm text-ink-dim mt-1">
                {author && <>by {author} · </>}
                bound by{" "}
                {owner?.username ? (
                  <Link
                    href={`/u/${owner.username}`}
                    className="text-arcane-bright hover:underline"
                  >
                    @{owner.username}
                  </Link>
                ) : (
                  (owner?.name ?? "Unknown")
                )}{" "}
                · {volumes.length} volume{volumes.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-ink-dim">
              {avg !== null ? (
                <>
                  <Stars value={avg} />
                  <span>
                    {avg.toFixed(1)} · {reviews.length} review
                    {reviews.length === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span>No ratings yet</span>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => (
                  <Link
                    key={t}
                    href={`/browse?tag=${encodeURIComponent(t)}`}
                    className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-heading uppercase tracking-wider text-ink-dim hover:text-ink"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {hasWritten && (
                <Link href={`/s/${s.slug}`} className="btn-arcane">
                  <BookOpenIcon /> Read the Series
                </Link>
              )}
              {hasAudio && (
                <Link
                  href={`/s/${s.slug}/listen`}
                  className={hasWritten ? "btn-ghost" : "btn-arcane"}
                >
                  <HeadphonesIcon /> Listen
                </Link>
              )}
              <SaveButton
                kind="series"
                itemId={s.id}
                saved={saved}
                signedIn={!!session}
              />
              {!isOwner && (
                <FollowSeriesButton
                  seriesId={s.id}
                  following={followingSeries}
                  signedIn={!!session}
                />
              )}
            </div>
          </div>
        </div>

        <section className="panel-arcane p-5 sm:p-6">
          <h2 className="font-heading text-lg mb-3">Volumes &amp; Episodes</h2>
          <ol className="space-y-1">
            {volumes.map((v) => {
              const vl = volumeLabel(v);
              return (
                <li
                  key={v.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 text-sm"
                >
                  <span className="font-heading text-xs text-ink-dim w-14 shrink-0">
                    {vl ? `Vol. ${vl}` : "—"}
                  </span>
                  <span className="truncate">{v.title}</span>
                  {v.sourceType === "audio" ? (
                    <HeadphonesIcon className="h-3.5 w-3.5 text-ink-dim shrink-0" />
                  ) : (
                    <BookOpenIcon className="h-3.5 w-3.5 text-ink-dim shrink-0" />
                  )}
                  {v.visibility !== "public" && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider text-ink-dim shrink-0">
                      private
                    </span>
                  )}
                  <Link
                    href={
                      v.sourceType === "audio"
                        ? `/j/${v.slug}/listen`
                        : `/j/${v.slug}`
                    }
                    className="ml-auto text-xs font-heading text-arcane-bright hover:underline shrink-0"
                  >
                    {v.sourceType === "audio" ? "Play" : "Read"}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <ReviewsSection
          kind="series"
          itemId={s.id}
          reviews={reviews.map((r) => ({
            ...r,
            updatedAt: r.updatedAt.toISOString(),
          }))}
          viewerId={session?.user.id ?? null}
          isOwner={isOwner ?? false}
          signedIn={!!session}
        />
      </div>
      </AppShell>
    </main>
  );
}
