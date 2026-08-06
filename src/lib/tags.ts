import { db } from "@/db";
import { tags, journalTags } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { newId } from "@/lib/id";
import { isTextSafe } from "@/lib/safety";

export const MAX_TAGS_PER_JOURNAL = 8;
const TAG_RE = /^[a-z0-9][a-z0-9 -]{1,29}$/;

/** Normalize + validate a raw tag list; returns clean names or an error. */
export function cleanTagNames(
  raw: string[]
): { ok: true; names: string[] } | { ok: false; error: string } {
  const names = [
    ...new Set(
      raw.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean)
    ),
  ];
  if (names.length > MAX_TAGS_PER_JOURNAL) {
    return { ok: false, error: `At most ${MAX_TAGS_PER_JOURNAL} tags.` };
  }
  for (const name of names) {
    if (!TAG_RE.test(name)) {
      return {
        ok: false,
        error: `"${name}" isn't a valid tag — 2-30 characters, letters/numbers/spaces/dashes.`,
      };
    }
    if (!isTextSafe(name)) {
      return { ok: false, error: `"${name}" isn't an allowed tag.` };
    }
  }
  return { ok: true, names };
}

/** Replace a journal's tags with the given (already cleaned) names. */
export async function setJournalTags(journalId: string, names: string[]) {
  const existing =
    names.length > 0
      ? await db.select().from(tags).where(inArray(tags.name, names))
      : [];
  const known = new Map(existing.map((t) => [t.name, t.id]));
  const toCreate = names.filter((n) => !known.has(n));
  if (toCreate.length > 0) {
    const created = await db
      .insert(tags)
      .values(toCreate.map((name) => ({ id: newId(), name })))
      .returning();
    for (const t of created) known.set(t.name, t.id);
  }
  await db.delete(journalTags).where(eq(journalTags.journalId, journalId));
  if (names.length > 0) {
    await db
      .insert(journalTags)
      .values(names.map((n) => ({ journalId, tagId: known.get(n)! })));
  }
}

export async function listJournalTags(journalId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(journalTags)
    .innerJoin(tags, eq(journalTags.tagId, tags.id))
    .where(eq(journalTags.journalId, journalId));
  return rows.map((r) => r.name).sort();
}
