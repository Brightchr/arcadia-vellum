import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  MAX_THEMES_PER_USER,
  createUserTheme,
  listThemesForOwner,
  parseThemeConfig,
} from "@/lib/custom-themes";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";

export const runtime = "nodejs";

/** List the caller's custom themes. */
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const themes = await listThemesForOwner(session.user.id);
  return Response.json({ themes });
}

/** Create a custom theme. Body: { name, config }. */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("A theme name is required", 400);
  if (name.length > 60) return jsonError("Theme name too long", 400);
  if (!isTextSafe(name)) return jsonError(UNSAFE_TEXT_ERROR, 400);

  const config = parseThemeConfig(body.config);
  if (!config) return jsonError("Invalid theme settings", 400);

  const existing = await listThemesForOwner(session.user.id);
  if (existing.length >= MAX_THEMES_PER_USER) {
    return jsonError(`You can keep up to ${MAX_THEMES_PER_USER} themes`, 400);
  }

  const theme = await createUserTheme(session.user.id, name, config);
  return Response.json({ theme });
}
