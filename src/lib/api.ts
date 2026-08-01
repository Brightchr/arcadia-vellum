import { auth } from "@/lib/auth";

export async function sessionFromRequest(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
