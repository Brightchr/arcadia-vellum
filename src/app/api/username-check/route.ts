import { sessionFromRequest, jsonError } from "@/lib/api";
import { usernameProblem, isUsernameTaken } from "@/lib/profile";

export const runtime = "nodejs";

/** Availability + validity check for a candidate username. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const candidate = (url.searchParams.get("u") ?? "").trim().toLowerCase();
  if (!candidate) return jsonError("Missing username", 400);

  const problem = usernameProblem(candidate);
  if (problem) return Response.json({ available: false, problem });

  const session = await sessionFromRequest(request);
  const taken = await isUsernameTaken(candidate, session?.user.id);
  return Response.json({
    available: !taken,
    problem: taken ? "That username is taken" : null,
  });
}
