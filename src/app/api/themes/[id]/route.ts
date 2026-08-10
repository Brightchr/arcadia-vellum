import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  deleteUserTheme,
  getOwnedTheme,
  parseThemeConfig,
  updateUserTheme,
} from "@/lib/custom-themes";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Update a custom theme (owner). Body: { name?, config? }. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const theme = await getOwnedTheme(id, session.user.id);
  if (!theme) return jsonError("Theme not found", 404);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const patch: { name?: string; config?: NonNullable<ReturnType<typeof parseThemeConfig>> } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    const name = body.name.trim();
    if (name.length > 60) return jsonError("Theme name too long", 400);
    if (!isTextSafe(name)) return jsonError(UNSAFE_TEXT_ERROR, 400);
    patch.name = name;
  }
  if (body.config !== undefined) {
    const config = parseThemeConfig(body.config);
    if (!config) return jsonError("Invalid theme settings", 400);
    patch.config = config;
  }
  if (Object.keys(patch).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  const updated = await updateUserTheme(id, patch);
  return Response.json({ theme: updated });
}

/** Delete a custom theme; journals wearing it fall back to the default. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const theme = await getOwnedTheme(id, session.user.id);
  if (!theme) return jsonError("Theme not found", 404);

  await deleteUserTheme(id);
  return Response.json({ ok: true });
}
