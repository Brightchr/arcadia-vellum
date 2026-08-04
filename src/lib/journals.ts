import { db } from "@/db";
import { journals, journalContent } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { newId, slugify } from "@/lib/id";
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes";

export type Journal = typeof journals.$inferSelect;

export async function listJournalsForOwner(ownerId: string) {
  return db
    .select()
    .from(journals)
    .where(eq(journals.ownerId, ownerId))
    .orderBy(desc(journals.createdAt));
}

export async function getJournalById(id: string) {
  const rows = await db.select().from(journals).where(eq(journals.id, id));
  return rows[0] ?? null;
}

export async function getOwnedJournal(id: string, ownerId: string) {
  const rows = await db
    .select()
    .from(journals)
    .where(and(eq(journals.id, id), eq(journals.ownerId, ownerId)));
  return rows[0] ?? null;
}

export async function getJournalBySlug(slug: string) {
  const rows = await db.select().from(journals).where(eq(journals.slug, slug));
  return rows[0] ?? null;
}

export async function getJournalContent(journalId: string) {
  const rows = await db
    .select()
    .from(journalContent)
    .where(eq(journalContent.journalId, journalId));
  return rows[0] ?? null;
}

export async function createJournal(input: {
  ownerId: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  seriesId?: string | null;
  volumeNumber?: number | null;
  theme?: ThemeId;
  sourceType: "gdoc" | "upload" | "audio";
  gdocFileId?: string | null;
}) {
  const id = newId();
  const slug = slugify(input.title);
  const [row] = await db
    .insert(journals)
    .values({
      id,
      ownerId: input.ownerId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      author: input.author ?? null,
      seriesId: input.seriesId ?? null,
      volumeNumber: input.volumeNumber ?? null,
      slug,
      theme: input.theme ?? DEFAULT_THEME,
      sourceType: input.sourceType,
      gdocFileId: input.gdocFileId ?? null,
    })
    .returning();
  return row;
}

export async function updateJournal(
  id: string,
  patch: Partial<
    Pick<
      Journal,
      | "title"
      | "subtitle"
      | "author"
      | "seriesId"
      | "volumeNumber"
      | "theme"
      | "visibility"
      | "gdocFileId"
    >
  >
) {
  const [row] = await db
    .update(journals)
    .set(patch)
    .where(eq(journals.id, id))
    .returning();
  return row ?? null;
}

export async function deleteJournal(id: string) {
  await db.delete(journals).where(eq(journals.id, id));
}
