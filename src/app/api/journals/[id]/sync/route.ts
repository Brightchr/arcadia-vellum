import { sessionFromRequest, jsonError } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { syncJournalFromDrive } from "@/lib/google/sync";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

  const result = await syncJournalFromDrive(journal);
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json({ ok: true });
}
